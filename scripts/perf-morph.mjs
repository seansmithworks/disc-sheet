#!/usr/bin/env node
/**
 * perf-morph.mjs — the morph-smoothness gate (docs/plans/motion-craft-audit.html,
 * item 3; DESIGN.md §4.8 "judge with the instrument, not memory").
 *
 * Turns "does the morph feel smooth?" into two numbers, checked against a
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
 *
 * Runs its OWN vite server on a fixed port (never :5180, which Sean uses)
 * and tears it down on exit, including on failure/SIGINT.
 *
 * Usage:
 *   npm run perf                    # measure vs perf/baseline.json, exit 1 on regression
 *   npm run perf -- --update-baseline
 *   npm run perf -- --cycles=8
 *   npm run perf -- --inject-glow   # AC3 only: prove the gate fires on a real regression
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
const INJECT_GLOW = flag("inject-glow"); // AC3 only — proves the gate fires
// AC3 only: on this machine's GPU (Apple Silicon/Metal), the demo's
// animated-blur glow is compositor-only and doesn't load the main-thread
// RasterTask trace or drop screencast frames, so it isn't a reliable
// regression to prove the gate against here. `--inject-jank` saturates the
// main thread with a real, observable-in-both-metrics regression instead
// (see README "Measuring smoothness").
const INJECT_JANK = flag("inject-jank");

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

// --- measurement -------------------------------------------------------

async function measure() {
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

    const gpu = await page.evaluate(() => {
      const c = document.createElement("canvas").getContext("webgl");
      const dbg = c && c.getExtension("WEBGL_debug_renderer_info");
      return dbg ? c.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "unknown";
    });

    const trigger = page.locator('[data-morph-sheet-part="trigger"]');
    const triggerBox = await trigger.boundingBox();
    const cx = triggerBox.x + triggerBox.width / 2;
    const cy = triggerBox.y + triggerBox.height / 2;

    const cycle = async () => {
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(1700); // open settle, per reference script
      const closeBox = await page.locator('[data-morph-sheet-part="close"]').boundingBox();
      await page.mouse.click(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2);
      await page.waitForTimeout(1600); // close settle
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

    for (let i = 0; i < CYCLES; i++) {
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

      await cycle();

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

      let longestGap = 0;
      for (let j = 1; j < screencastFrames.length; j++) {
        longestGap = Math.max(longestGap, screencastFrames[j] - screencastFrames[j - 1]);
      }
      longestGapPerCycle.push(longestGap);
    }

    return { gpu, rasterMsPerCycle, frameCountPerCycle, longestGapPerCycle };
  } finally {
    await browser.close();
  }
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

async function main() {
  await startVite();
  const commit = await sh(["rev-parse", "--short", "HEAD"]);
  const { gpu, rasterMsPerCycle, frameCountPerCycle, longestGapPerCycle } = await measure();

  const raster = summarize(rasterMsPerCycle);
  const frames = summarize(frameCountPerCycle);
  const longestGap = Math.max(...longestGapPerCycle);

  console.log("morph-sheet perf");
  console.log(`  gpu:        ${gpu}`);
  console.log(`  cycles:     ${CYCLES} (+2 warm-up, discarded)`);
  console.log(`  glow:       ${INJECT_GLOW ? "ON (--inject-glow)" : "off"}`);
  console.log(`  jank:       ${INJECT_JANK ? "ON (--inject-jank)" : "off"}`);
  console.log("");
  printTable([
    ["metric", "median", "min", "max"],
    ["raster ms/cycle", raster.median.toFixed(1), raster.min.toFixed(1), raster.max.toFixed(1)],
    ["frames/cycle", String(frames.median), String(frames.min), String(frames.max)],
  ]);
  console.log(`  longest frame gap: ${longestGap.toFixed(1)}ms`);
  console.log(`  per-cycle raster:  ${rasterMsPerCycle.map((n) => n.toFixed(1)).join(", ")}`);
  console.log(`  per-cycle frames:  ${frameCountPerCycle.join(", ")}`);

  if (UPDATE_BASELINE) {
    const baseline = {
      gpu,
      viewport: { width: 1280, height: 800 },
      date: new Date().toISOString().slice(0, 10),
      commit,
      cycles: CYCLES,
      raster,
      frames,
      // Tolerances derived from run-to-run variance observed across 3
      // consecutive `npm run perf` runs on this machine (see README +
      // report): raster ms varies more than frame count run-to-run, so it
      // gets a looser band.
      tolerance: { rasterPct: 0.35, framesPct: 0.15 },
    };
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n");
    console.log("");
    console.log(`baseline written -> ${BASELINE_PATH}`);
    return 0;
  }

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
  ]);

  return rasterPass && framesPass ? 0 : 1;
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
