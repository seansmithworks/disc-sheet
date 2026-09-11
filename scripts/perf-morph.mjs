#!/usr/bin/env node
/**
 * perf-morph.mjs — the morph-smoothness gate (docs/plans/motion-craft-audit.html,
 * item 3; DESIGN.md §4.8 "judge with the instrument, not memory").
 *
 * Turns "does the morph feel smooth?" into three numbers, checked against a
 * checked-in baseline:
 *
 *   1. raster ms   — CDP `Tracing` totals for RasterTask (+ paint) durations
 *      during a warm open+close cycle. This is the number that actually
 *      moves when the compositor is starved; rAF gap timing does not see it
 *      (reference_measuring-smoothness.md: 347ms -> 3070ms raster with the
 *      demo glow on, while rAF kept reporting 120fps).
 *   2. rendered frames — count of `Page.screencastFrame` events CDP emits
 *      during the same cycle. Chosen over decoding a fixed-fps ffmpeg
 *      capture because the screencast is driven by Chromium's own frame
 *      producer: it only emits when a new compositor frame is actually
 *      presented, so a starved compositor directly produces fewer frames
 *      here — no new dependency (ffmpeg is not a repo dependency) and no
 *      decimation heuristic needed. Both signals are pulled from the same
 *      cycle window in a single pass.
 *   3. longest frame gap — the single largest interval between two
 *      consecutive screencast frames in a cycle. A main-thread stall can
 *      hide inside a healthy median (fewer, but evenly-spaced frames) while
 *      still reading as a visible hitch; this catches that shape.
 *
 * Runs its OWN vite server on a fixed port (never :5180, which Sean uses)
 * and tears it down on exit, including on failure/SIGINT.
 *
 * Usage:
 *   npm run perf                    # measure vs perf/baseline.json, exit 1 on regression
 *   npm run perf -- --update-baseline
 *   npm run perf -- --cycles=8
 *   npm run perf -- --inject-glow   # AC3 only: prove the gate fires on a real regression
 *   npm run perf -- --inject-jank   # AC3 only: main-thread-starvation proxy regression
 *   npm run perf -- --inject-gpu    # AC3 only: compositor/GPU-load proxy regression
 *
 * Baseline model (--update-baseline): a single cold launch is not steady
 * state — the first open after browser launch renders roughly half the
 * distinct frames of any later open (reference_measuring-smoothness.md).
 * To anchor the baseline to warm steady state instead of a lucky or
 * unlucky single sample, `--update-baseline` runs BASELINE_LAUNCHES
 * separate browser launches of CYCLES cycles each, throws away the first
 * launch *entirely* (not just its in-page warm-up cycles — a whole cold
 * launch, post-idle warm-up), and also discards each remaining launch's own
 * 2 in-page warm-up cycles. The baseline's median/spread come from the
 * pooled per-cycle samples of the remaining launches only. Tolerances are
 * then derived from that pooled spread (see deriveTolerance below) instead
 * of being hand-picked, so they track whatever this machine's real
 * run-to-run variance is on the day of rebaseline.
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadavg, cpus } from "node:os";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_PATH = join(ROOT, "perf", "baseline.json");
const PORT = 5190;
const BASE_URL = `http://localhost:${PORT}/`;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const valueOf = (name, fallback) => {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? Number(found.slice(prefix.length)) : fallback;
};

const UPDATE_BASELINE = flag("update-baseline");
const CYCLES = valueOf("cycles", 5);
const BASELINE_LAUNCHES = valueOf("baseline-launches", 5);
const INJECT_GLOW = flag("inject-glow"); // AC3 only — proves the gate fires
// AC3 only: on this machine's GPU (Apple Silicon/Metal), the demo's
// animated-blur glow is compositor-only and doesn't load the main-thread
// RasterTask trace or drop screencast frames, so it isn't a reliable
// regression to prove the gate against here. `--inject-jank` saturates the
// main thread with a real, observable-in-both-metrics regression instead
// (see README "Measuring smoothness").
const INJECT_JANK = flag("inject-jank");
// AC3 only: heavier, run-time-only GPU/compositor load than --inject-glow —
// several stacked full-viewport layers with large backdrop-filter blur,
// animated independently of the app — used to check whether the gate's two
// metrics are compositor/GPU-blind (see README).
const INJECT_GPU = flag("inject-gpu");
const WAIT_FOR_QUIET = flag("wait-for-quiet");
const WAIT_TIMEOUT_MS = valueOf("wait-for-quiet-timeout", 20 * 60 * 1000);

// --- machine-quiet gate ------------------------------------------------
//
// Raster ms and frame counts are absolute wall-clock/compositor numbers —
// contention from unrelated processes (another test browser, Spotlight
// indexing, another heavy app) inflates raster time and starves the
// compositor exactly like a real regression would, so a baseline or gate
// run captured under load is not measuring the morph. Refuse to measure
// (baseline) or measure with a loud warning (gate) rather than silently
// producing numbers that look like a regression, or a baseline that bakes
// in someone else's CPU spike.
const QUIET_LOAD_FACTOR = 0.5; // loadavg(1min) must be below this * core count
const CORES = cpus().length;
const QUIET_THRESHOLD = CORES * QUIET_LOAD_FACTOR;

// Test-only hook (see README "Measuring smoothness"): PERF_FAKE_LOAD_SEQUENCE
// feeds a fixed, comma-separated sequence of loadavg(1min) values instead of
// reading the real machine, one value per call to currentLoad(). This is how
// the per-launch quiet gate below is proven to fire on a specific launch
// (e.g. "1,1,99" makes launch 3 see load) without needing the real machine to
// spike on cue. Never set in normal use.
const fakeLoadSequence = process.env.PERF_FAKE_LOAD_SEQUENCE
  ? process.env.PERF_FAKE_LOAD_SEQUENCE.split(",").map(Number)
  : null;
let fakeLoadIndex = 0;

function currentLoad() {
  if (fakeLoadSequence) {
    const v = fakeLoadSequence[Math.min(fakeLoadIndex, fakeLoadSequence.length - 1)];
    fakeLoadIndex += 1;
    return v;
  }
  return loadavg()[0];
}

function isQuiet(load) {
  return load < QUIET_THRESHOLD;
}

async function waitForQuiet() {
  const start = Date.now();
  let load = currentLoad();
  while (!isQuiet(load)) {
    if (Date.now() - start > WAIT_TIMEOUT_MS) {
      return { quiet: false, load };
    }
    console.log(
      `  waiting for quiet machine: load1=${load.toFixed(2)} (need < ${QUIET_THRESHOLD.toFixed(1)}, ${CORES} cores)...`,
    );
    await new Promise((r) => setTimeout(r, 15000));
    load = currentLoad();
  }
  return { quiet: true, load };
}

// Checks the machine is quiet before ONE specific launch (called fresh for
// every baseline launch, not once before the whole loop) — a load spike
// mid-run, which easily takes minutes across BASELINE_LAUNCHES launches,
// would otherwise silently contaminate later launches. Returns the load1
// used for this launch on success; returns null (and writes nothing) on
// refusal, deciding between "abort" and "poll" per --wait-for-quiet exactly
// like the old one-shot check did.
async function requireQuietForLaunch(launchNum, total) {
  let load = currentLoad();
  if (isQuiet(load)) return load;
  if (WAIT_FOR_QUIET) {
    const result = await waitForQuiet();
    if (!result.quiet) {
      console.error("");
      console.error(
        `Machine did not quiet down before launch ${launchNum}/${total} within ` +
          `${Math.round(WAIT_TIMEOUT_MS / 60000)}min (load1=${result.load.toFixed(2)}, need < ` +
          `${QUIET_THRESHOLD.toFixed(1)} on ${CORES} cores). Refusing to write a baseline captured under load.`,
      );
      return null;
    }
    return result.load;
  }
  console.error("");
  console.error(
    `Refusing to start baseline launch ${launchNum}/${total}: load1=${load.toFixed(2)} >= ` +
      `${QUIET_THRESHOLD.toFixed(1)} (0.5 * ${CORES} cores) — the machine isn't quiet, so raster/frame ` +
      `numbers would bake in someone else's CPU load, not the morph. Re-run when idle, or pass ` +
      `--wait-for-quiet to poll (default timeout ${Math.round(WAIT_TIMEOUT_MS / 60000)}min).`,
  );
  return null;
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function sh(cmd) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", cmd, { cwd: ROOT });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("close", (code) =>
      code === 0 ? resolve(out.trim()) : reject(new Error(`git ${cmd.join(" ")} failed`)),
    );
  });
}

// --- vite server lifecycle -------------------------------------------------

let viteProc = null;

function startVite() {
  return new Promise((resolve, reject) => {
    viteProc = spawn(
      join(ROOT, "node_modules", ".bin", "vite"),
      ["example", "--port", String(PORT), "--strictPort"],
      { cwd: ROOT, detached: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    let settled = false;
    const onData = (d) => {
      if (settled) return;
      if (String(d).includes("ready in") || String(d).includes("Local:")) {
        settled = true;
        resolve();
      }
    };
    viteProc.stdout.on("data", onData);
    viteProc.stderr.on("data", (d) => {
      const s = String(d);
      if (s.includes("Port") && s.includes("is in use")) {
        settled = true;
        reject(new Error(`Port ${PORT} is already in use — refusing to start (see stderr): ${s}`));
      }
    });
    viteProc.on("error", (e) => {
      if (!settled) {
        settled = true;
        reject(e);
      }
    });
    viteProc.on("exit", (code) => {
      if (!settled && code !== 0) {
        settled = true;
        reject(new Error(`vite exited early with code ${code}`));
      }
    });
    setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`vite did not report ready within 15s on port ${PORT}`));
      }
    }, 15000);
  });
}

function stopVite() {
  if (!viteProc || viteProc.killed) return;
  try {
    // detached: true put vite in its own process group; kill the group so
    // esbuild's child processes die with it, not just the shell wrapper.
    process.kill(-viteProc.pid, "SIGTERM");
  } catch {
    try {
      viteProc.kill("SIGTERM");
    } catch {
      // already gone
    }
  }
  viteProc = null;
}

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  stopVite();
}
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

// --- GPU/compositor-load injection (AC3 only, run time only) ---------------

// Several stacked full-viewport layers with a large backdrop-filter blur,
// each animated by its own CSS animation (not tied to the app's rAF loop),
// so a compositor-blind gate would see nothing while ground truth
// (agent-browser recording + distinct-frame count) can still show real
// frame loss. Injected as a style tag + DOM nodes at run time only — no
// app file is touched.
async function injectGpuLoad(page) {
  await page.addStyleTag({
    content: `
      .perf-gpu-load-layer {
        position: fixed;
        inset: 0;
        z-index: 9999;
        pointer-events: none;
        mix-blend-mode: multiply;
        backdrop-filter: blur(120px) saturate(3);
        -webkit-backdrop-filter: blur(120px) saturate(3);
        animation: perf-gpu-load-spin 1.1s linear infinite;
        opacity: 0.9;
      }
      .perf-gpu-load-layer:nth-child(2) { animation-duration: 0.7s; animation-direction: reverse; }
      .perf-gpu-load-layer:nth-child(3) { animation-duration: 1.6s; }
      .perf-gpu-load-layer:nth-child(4) { animation-duration: 0.5s; animation-direction: reverse; }
      @keyframes perf-gpu-load-spin {
        from { transform: scale(1.4) rotate(0deg); }
        to { transform: scale(1.4) rotate(360deg); }
      }
    `,
  });
  await page.evaluate(() => {
    for (let i = 0; i < 4; i++) {
      const el = document.createElement("div");
      el.className = "perf-gpu-load-layer";
      el.dataset.perfGpuLoad = "true";
      document.body.appendChild(el);
    }
  });
}

// `label` identifies which measured motion window this check ran inside
// ("open" or "close") so a failure names the window that wasn't actually
// contending, not just "sometime in the cycle".
async function assertGpuLoadAnimating(page, label) {
  const info = await page.evaluate(() => {
    const layers = Array.from(document.querySelectorAll("[data-perf-gpu-load]"));
    const before = layers.map((el) => getComputedStyle(el).transform);
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const after = layers.map((el) => getComputedStyle(el).transform);
          const opacities = layers.map((el) => Number(getComputedStyle(el).opacity));
          resolve({ count: layers.length, before, after, opacities });
        }, 60);
      });
    });
  });
  if (info.count !== 4) {
    throw new Error(`--inject-gpu (${label} window): expected 4 layers mounted, found ${info.count}`);
  }
  if (info.opacities.some((o) => !(o > 0))) {
    throw new Error(`--inject-gpu (${label} window): a layer is not visible (opacity 0): ${info.opacities}`);
  }
  const changed = info.before.some((t, i) => t !== info.after[i]);
  if (!changed) {
    throw new Error(
      `--inject-gpu (${label} window): layers mounted but transform did not change during the measured ` +
        `motion window — not contending while the morph is actually scored`,
    );
  }
}

// --- measurement -------------------------------------------------------

// One full browser launch: 2 discarded in-page warm-up cycles (the first
// open after any launch renders ~half the distinct frames of a later one —
// reference_measuring-smoothness.md) followed by `cycles` measured cycles.
// Returns raw per-cycle arrays only; the caller decides how to pool/summarize
// across launches.
async function measureLaunch(cycles) {
  const browser = await chromium.launch({ headless: false });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    // Glow OFF by default (DESIGN.md §4.8: judge with the glow off). Set via
    // the demo's own persisted toggle, at run time only.
    await page.addInitScript(
      (inject) => localStorage.setItem("morph-sheet-example:iridescent", inject ? "1" : "0"),
      INJECT_GLOW,
    );
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);

    const glowMounted = await page.locator(".iri-shadow").count();
    if (INJECT_GLOW && glowMounted === 0) {
      throw new Error("--inject-glow was set but .iri-shadow did not mount");
    }
    if (!INJECT_GLOW && glowMounted !== 0) {
      throw new Error(".iri-shadow is mounted with glow OFF — the demo toggle did not apply");
    }

    if (INJECT_GPU) {
      await injectGpuLoad(page);
    }

    const gpu = await page.evaluate(() => {
      const c = document.createElement("canvas").getContext("webgl");
      const dbg = c && c.getExtension("WEBGL_debug_renderer_info");
      return dbg ? c.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "unknown";
    });

    const trigger = page.locator('[data-morph-sheet-part="trigger"]');
    const triggerBox = await trigger.boundingBox();
    const cx = triggerBox.x + triggerBox.width / 2;
    const cy = triggerBox.y + triggerBox.height / 2;

    // `frames` (only passed during measured cycles, not warm-up) is the
    // in-flight screencastFrames array for this cycle. `cycle` snapshots its
    // length right after each click and again after a fixed 900ms motion
    // window (DESIGN.md springs settle in ~640ms; 900ms leaves margin) so
    // callers can compute the longest inter-frame gap *during the morph
    // only*. Without this, the gap spans the whole open/close hold as well
    // — nothing paints while the sheet sits still, so that idle hold itself
    // produces an ~850ms "gap" on every healthy run, drowning out any real
    // stall the metric is meant to catch.
    //
    // With --inject-gpu, each 900ms motion window is split so the
    // contention check runs AT the midpoint of that same window, not in the
    // idle hold after it — proving the injected layers are live while the
    // morph is actually being scored, not just live somewhere in the cycle.
    const cycle = async (frames) => {
      await page.mouse.click(cx, cy);
      const openStart = frames ? frames.length : 0;
      await page.waitForTimeout(450); // first half of the open motion window
      if (INJECT_GPU) {
        await assertGpuLoadAnimating(page, "open");
      }
      await page.waitForTimeout(450); // second half of the open motion window
      const openEnd = frames ? frames.length : 0;
      await page.waitForTimeout(800); // remaining hold before next action
      const closeBox = await page.locator('[data-morph-sheet-part="close"]').boundingBox();
      await page.mouse.click(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2);
      const closeStart = frames ? frames.length : 0;
      await page.waitForTimeout(450); // first half of the close motion window
      if (INJECT_GPU) {
        await assertGpuLoadAnimating(page, "close");
      }
      await page.waitForTimeout(450); // second half of the close motion window
      const closeEnd = frames ? frames.length : 0;
      await page.waitForTimeout(700); // remaining hold
      return [
        [openStart, openEnd],
        [closeStart, closeEnd],
      ];
    };

    // Warm-up: discard 2 cycles. The first open after launch renders ~half
    // the distinct frames on any build (reference_measuring-smoothness.md).
    await cycle();
    await cycle();

    if (INJECT_JANK) {
      // Busy-blocks the main thread ~20ms every rAF tick — starves the same
      // thread that drives the shadow's per-frame resize (DESIGN.md §4.3),
      // a realistic proxy for "something now costs more on the main thread"
      // regressions. Not a file edit: injected into the live page only.
      await page.evaluate(() => {
        function tick() {
          const start = performance.now();
          while (performance.now() - start < 20) {
            /* intentional busy-block */
          }
          requestAnimationFrame(tick);
        }
        tick();
      });
    }

    const cdp = await ctx.newCDPSession(page);
    const rasterMsPerCycle = [];
    const frameCountPerCycle = [];
    const longestGapPerCycle = [];

    for (let i = 0; i < cycles; i++) {
      const traceEvents = [];
      const screencastFrames = [];
      const onTraceData = (d) => traceEvents.push(...d.value);
      const onFrame = (f) => {
        screencastFrames.push(f.metadata.timestamp * 1000); // -> ms
        cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
      };
      cdp.on("Tracing.dataCollected", onTraceData);
      cdp.on("Page.screencastFrame", onFrame);

      await cdp.send("Tracing.start", {
        categories: "disabled-by-default-devtools.timeline,devtools.timeline,blink",
        options: "sampling-frequency=10000",
      });
      await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });

      const motionWindows = await cycle(screencastFrames);

      await cdp.send("Page.stopScreencast");
      await new Promise((resolve) => {
        cdp.once("Tracing.tracingComplete", resolve);
        cdp.send("Tracing.end");
      });
      cdp.off("Tracing.dataCollected", onTraceData);
      cdp.off("Page.screencastFrame", onFrame);

      const rasterTotal =
        traceEvents
          .filter((e) => e.name === "RasterTask")
          .reduce((sum, e) => sum + (e.dur || 0), 0) / 1000;
      rasterMsPerCycle.push(rasterTotal);
      frameCountPerCycle.push(screencastFrames.length);

      // Longest gap is scoped to the motion windows only (see `cycle`
      // above) — not the whole cycle, which includes an idle hold that
      // paints nothing and would otherwise dominate this metric.
      let longestGap = 0;
      for (const [start, end] of motionWindows) {
        for (let j = start + 1; j < end; j++) {
          longestGap = Math.max(longestGap, screencastFrames[j] - screencastFrames[j - 1]);
        }
      }
      longestGapPerCycle.push(longestGap);
    }

    return { gpu, rasterMsPerCycle, frameCountPerCycle, longestGapPerCycle };
  } finally {
    await browser.close();
  }
}

// Test-only, reachable only when PERF_FAKE_LOAD_SEQUENCE is set: stands in
// for measureLaunch() so the per-launch quiet gate can be proven to fire on
// a specific launch without paying for a real (headed, GPU) browser launch
// per iteration. Never runs in normal use.
function fakeMeasureLaunch(cycles) {
  const n = Array.from({ length: cycles }, () => 1);
  return {
    gpu: "fake (PERF_FAKE_LOAD_SEQUENCE)",
    rasterMsPerCycle: n.map(() => 10),
    frameCountPerCycle: n.map(() => 30),
    longestGapPerCycle: n.map(() => 20),
  };
}

function summarize(nums) {
  return { median: median(nums), min: Math.min(...nums), max: Math.max(...nums) };
}

function printTable(rows) {
  const widest = Math.max(...rows.map((r) => r[0].length));
  for (const [label, ...cols] of rows) {
    console.log(`${label.padEnd(widest)}  ${cols.join("  ")}`);
  }
}

// Derives a one-sided tolerance fraction from a pooled sample's spread
// around its median, with a floor (so normal run-to-run noise doesn't
// flake the gate) and a ceiling strictly below the regression size we need
// to catch (so that regression is never masked by a wide observed spread).
// margin widens the observed spread by 50% as a safety margin over the
// exact sample seen at rebaseline time.
//
// `direction` picks which side of the median the metric regresses toward:
// "high" for ceiling metrics (raster ms, longest gap — regression means a
// bigger number) uses the high-side spread (max - median); "low" for floor
// metrics (frames — regression means a smaller number) uses the low-side
// spread (median - min). Using the wrong side silently produces a
// tolerance that ignores the exact outliers it exists to size against.
function deriveTolerance(summary, { floor, ceiling, margin = 1.5, direction }) {
  const spreadPct =
    direction === "low"
      ? (summary.median - summary.min) / summary.median
      : (summary.max - summary.median) / summary.median;
  return Math.min(ceiling, Math.max(floor, spreadPct * margin));
}

async function main() {
  await startVite();
  const commit = await sh(["rev-parse", "--short", "HEAD"]);

  if (UPDATE_BASELINE) {
    const launches = [];
    const load1PerLaunch = [];
    for (let i = 0; i < BASELINE_LAUNCHES; i++) {
      // Checked fresh before EACH launch, not once before the loop — a
      // launch takes minutes, and a load spike between launches would
      // otherwise contaminate a later launch under a check that already
      // passed. See requireQuietForLaunch.
      const load = await requireQuietForLaunch(i + 1, BASELINE_LAUNCHES);
      if (load == null) return 1;
      load1PerLaunch.push(load);
      console.log(
        `baseline launch ${i + 1}/${BASELINE_LAUNCHES} (load1=${load.toFixed(2)}, threshold < ` +
          `${QUIET_THRESHOLD.toFixed(1)}, ${CORES} cores)...`,
      );
      const result = fakeLoadSequence ? fakeMeasureLaunch(CYCLES) : await measureLaunch(CYCLES);
      launches.push(result);
      printTable([
        ["metric", "median", "min", "max"],
        ["  raster ms/cycle", ...Object.values(summarize(result.rasterMsPerCycle)).map((n) => n.toFixed(1))],
        ["  frames/cycle", ...Object.values(summarize(result.frameCountPerCycle)).map(String)],
        ["  longest gap ms", ...Object.values(summarize(result.longestGapPerCycle)).map((n) => n.toFixed(1))],
      ]);
    }

    // Discard the first launch entirely (cold-start, not steady state).
    const steadyLaunches = launches.slice(1);
    console.log(
      `\ndiscarding launch 1/${BASELINE_LAUNCHES} entirely (cold start); ` +
        `baseline built from launches 2-${BASELINE_LAUNCHES} (${steadyLaunches.length} launches, ` +
        `each with its own 2 discarded in-page warm-up cycles).`,
    );

    const pooledRaster = steadyLaunches.flatMap((l) => l.rasterMsPerCycle);
    const pooledFrames = steadyLaunches.flatMap((l) => l.frameCountPerCycle);
    const pooledLongestGap = steadyLaunches.flatMap((l) => l.longestGapPerCycle);

    const raster = summarize(pooledRaster);
    const frames = summarize(pooledFrames);
    const longestGap = summarize(pooledLongestGap);

    // Raster is noisier run-to-run than frame count; longest-gap sits
    // between the two. Floors keep the gate from flaking across normal
    // runs; ceilings keep a real regression (2x raster, >=15% frame drop)
    // from ever being masked by a wide observed spread. See README.
    const rasterPct = deriveTolerance(raster, { floor: 0.2, ceiling: 0.9, direction: "high" });
    const framesPct = deriveTolerance(frames, { floor: 0.03, ceiling: 0.12, direction: "low" });
    const longestGapPct = deriveTolerance(longestGap, { floor: 0.3, ceiling: 0.9, direction: "high" });

    console.log(`\npooled steady-state samples: raster n=${pooledRaster.length}, frames n=${pooledFrames.length}`);
    printTable([
      ["metric", "median", "min", "max", "derived tolerance"],
      ["raster ms", raster.median.toFixed(1), raster.min.toFixed(1), raster.max.toFixed(1), `+${(rasterPct * 100).toFixed(0)}% ceiling`],
      ["frames", String(frames.median), String(frames.min), String(frames.max), `-${(framesPct * 100).toFixed(0)}% floor`],
      ["longest gap ms", longestGap.median.toFixed(1), longestGap.min.toFixed(1), longestGap.max.toFixed(1), `+${(longestGapPct * 100).toFixed(0)}% ceiling`],
    ]);

    const baseline = {
      gpu: steadyLaunches[0].gpu,
      viewport: { width: 1280, height: 800 },
      date: new Date().toISOString().slice(0, 10),
      commit,
      cycles: CYCLES,
      baselineLaunches: BASELINE_LAUNCHES,
      load1PerLaunch,
      raster,
      frames,
      longestGap,
      // One-sided: raster and longestGap are ceilings only (regression =
      // more raster / a bigger stall), frames is a floor only (regression =
      // fewer composited frames). Derived from this rebaseline's pooled
      // steady-state spread across launches 2-N, not hand-picked — see
      // deriveTolerance above and the README "Measuring smoothness"
      // section for the resulting sensitivity.
      tolerance: { rasterPct, framesPct, longestGapPct },
    };
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n");
    console.log("");
    console.log(`baseline written -> ${BASELINE_PATH}`);
    return 0;
  }

  const gateLoad = currentLoad();
  if (gateLoad >= QUIET_THRESHOLD) {
    console.error(
      `warning: load1=${gateLoad.toFixed(2)} >= ${QUIET_THRESHOLD.toFixed(1)} (0.5 * ${CORES} cores) — ` +
        `this run may read as a false regression. Results below are not refused, but treat a FAIL ` +
        `under this warning as suspect until re-run quiet.`,
    );
  }

  const { gpu, rasterMsPerCycle, frameCountPerCycle, longestGapPerCycle } = await measureLaunch(CYCLES);

  const raster = summarize(rasterMsPerCycle);
  const frames = summarize(frameCountPerCycle);
  const longestGap = summarize(longestGapPerCycle);

  console.log("morph-sheet perf");
  console.log(`  load1:      ${gateLoad.toFixed(2)} (quiet threshold < ${QUIET_THRESHOLD.toFixed(1)}, ${CORES} cores)`);
  console.log(`  gpu:        ${gpu}`);
  console.log(`  cycles:     ${CYCLES} (+2 warm-up, discarded)`);
  console.log(`  glow:       ${INJECT_GLOW ? "ON (--inject-glow)" : "off"}`);
  console.log(`  jank:       ${INJECT_JANK ? "ON (--inject-jank)" : "off"}`);
  console.log(`  gpu-load:   ${INJECT_GPU ? "ON (--inject-gpu)" : "off"}`);
  console.log("");
  printTable([
    ["metric", "median", "min", "max"],
    ["raster ms/cycle", raster.median.toFixed(1), raster.min.toFixed(1), raster.max.toFixed(1)],
    ["frames/cycle", String(frames.median), String(frames.min), String(frames.max)],
    ["longest gap ms", longestGap.median.toFixed(1), longestGap.min.toFixed(1), longestGap.max.toFixed(1)],
  ]);
  console.log(`  per-cycle raster:      ${rasterMsPerCycle.map((n) => n.toFixed(1)).join(", ")}`);
  console.log(`  per-cycle frames:      ${frameCountPerCycle.join(", ")}`);
  console.log(`  per-cycle longest gap: ${longestGapPerCycle.map((n) => n.toFixed(1)).join(", ")}`);

  if (!existsSync(BASELINE_PATH)) {
    console.error("");
    console.error(`No baseline at ${BASELINE_PATH}. Run: npm run perf -- --update-baseline`);
    return 1;
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const rasterCeiling = baseline.raster.median * (1 + baseline.tolerance.rasterPct);
  const framesFloor = baseline.frames.median * (1 - baseline.tolerance.framesPct);

  const rasterPass = raster.median <= rasterCeiling;
  const framesPass = frames.median >= framesFloor;

  // An older baseline.json (pre-longestGap gating) won't have this field or
  // its tolerance. Skip the check with a visible warning rather than
  // crashing on `baseline.longestGap.median` — and rather than silently
  // treating it as passed, which would look identical to an actually-run
  // check in the table below.
  const hasLongestGapBaseline = baseline.longestGap != null && baseline.tolerance.longestGapPct != null;
  let longestGapPass = true;
  let longestGapCeiling = null;
  if (hasLongestGapBaseline) {
    longestGapCeiling = baseline.longestGap.median * (1 + baseline.tolerance.longestGapPct);
    longestGapPass = longestGap.median <= longestGapCeiling;
  } else {
    console.log("");
    console.log(
      `warning: baseline.json has no "longestGap" field (pre-dates that gate) — SKIPPING the longest-gap ` +
        `check. Rebaseline with --update-baseline on a quiet machine to enable it.`,
    );
  }

  console.log("");
  console.log(`vs baseline (commit ${baseline.commit}, ${baseline.date}):`);
  printTable([
    ["metric", "baseline", "observed", "limit", "result"],
    [
      "raster ms",
      baseline.raster.median.toFixed(1),
      raster.median.toFixed(1),
      `<= ${rasterCeiling.toFixed(1)}`,
      rasterPass ? "PASS" : "FAIL",
    ],
    [
      "frames",
      String(baseline.frames.median),
      String(frames.median),
      `>= ${framesFloor.toFixed(1)}`,
      framesPass ? "PASS" : "FAIL",
    ],
    [
      "longest gap ms",
      hasLongestGapBaseline ? baseline.longestGap.median.toFixed(1) : "n/a",
      longestGap.median.toFixed(1),
      hasLongestGapBaseline ? `<= ${longestGapCeiling.toFixed(1)}` : "n/a",
      hasLongestGapBaseline ? (longestGapPass ? "PASS" : "FAIL") : "SKIPPED",
    ],
  ]);

  return rasterPass && framesPass && longestGapPass ? 0 : 1;
}

main()
  .then((code) => {
    cleanup();
    process.exit(code);
  })
  .catch((err) => {
    console.error(err);
    cleanup();
    process.exit(1);
  });
