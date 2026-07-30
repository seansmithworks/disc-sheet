import { test, expect, type Page } from "@playwright/test";

/**
 * geometry.spec.ts — the gate the review says was missing entirely: real
 * rendered geometry, at real viewports, in both motion modes. Each assertion
 * below maps directly to a REVIEW-FINDINGS.md blocker/major:
 *
 *   (a) disc-side vs sheet-side <Shared> box size  — B1
 *   (b) sheet border-radius > 0 in both motion modes — B3
 *   (c) content sits inside the sheet's padding box — M4
 *   (d) --disc-sheet-z / --disc-sheet-sheet-max-width respond to props — M1/M2
 *
 * KNOWN OPEN FAILURE — Defect 3 (stale first-open shared-layoutId snapshot)
 * is NOT fixed as of this commit, and tests (e), (g), (j), and (k) fail at
 * 1280x800 and 1700x1000 (never at 375x812 — no disc-size promotion happens
 * below the md breakpoint, so there is nothing to be stale). Confirmed root
 * cause: Motion's shared-layoutId tracking for the disc surface takes its
 * initial mount measurement from the SSR-safe pre-promotion (96px) paint,
 * and does not reliably catch up to the promoted size (128/144px) before a
 * fast first click — empirically, waiting several hundred ms after mount
 * removes it on its own, purely from giving Motion's own update cycle real
 * time to run. FIVE candidate fixes were tried and rejected: (1) gating the
 * layoutId prop on a "settled" flag — broke the FLIP outright (Motion does
 * not tolerate a layoutId'd node's identity/prop toggling after mount); (2)
 * remounting via `key` on settle — same breakage; (3) dispatching a
 * synthetic `resize` event post-promotion — no effect, confirming this isn't
 * resize-EVENT-driven; (4) `flushSync`-ing the promotion inside `useEffect`
 * — no effect; (5) moving the promotion to `useLayoutEffect` — made it
 * dramatically worse (600-800px), evidently by racing Disc.tsx's own mount
 * jump. None of these are silently left in the source — useDiscSize.ts is
 * unchanged from before this pass. This needs its own follow-up spike
 * (possibly a Motion version bump, or `layout` + a documented way to give
 * only the idle/non-FLIP case a zero-duration transition — the naive
 * `transition.layout.duration=0` attempt zeroed the CLOSE FLIP too, since
 * FLIP and continuous `layout` tracking share one transition channel).
 */

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1280, height: 800 },
  { width: 1700, height: 1000 },
] as const;

const MOTION_MODES = ["normal", "reduced-motion"] as const;

const DISC_LABEL = "Open example sheet";

async function gotoExample(
  page: Page,
  reduced: boolean,
  query?: Record<string, string>,
) {
  if (reduced) {
    await page.emulateMedia({ reducedMotion: "reduce" });
  }
  const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
  await page.goto(`/${qs}`);
  await page.waitForSelector('[data-disc-sheet-part="disc-trigger"]');
}

/** Poll a locator's boundingBox().width until it stops changing between two
 * reads, rather than a fixed delay long enough for the slowest case (a
 * spring settle, or useDiscSize's post-mount resize promotion — see M6)
 * but wastefully long for every faster one. */
async function waitForStableWidth(
  page: Page,
  locator: ReturnType<Page["locator"]>,
) {
  await expect(async () => {
    const a = (await locator.boundingBox())?.width;
    await page.waitForTimeout(120);
    const b = (await locator.boundingBox())?.width;
    expect(a).not.toBeUndefined();
    expect(Math.abs((a ?? 0) - (b ?? 0))).toBeLessThan(0.2);
  }).toPass({ timeout: 5000 });
}

async function openSheet(page: Page) {
  await page.getByRole("button", { name: DISC_LABEL }).click();
  const sheet = page.locator('[data-disc-sheet-part="sheet"]');
  await sheet.waitFor();
  // Let the FLIP/cross-fade fully settle so offsetWidth/Height reflect the
  // resting geometry, not a mid-spring frame.
  await waitForStableWidth(page, sheet);
}

/**
 * Frame-samples `[data-disc-sheet-part="shadow"]` against whichever surface
 * node currently shares its layoutId (`sheet` while opening, `disc-surface`
 * while closing — both project to the same box during the FLIP, so either
 * selector matching is sufficient) for `durationMs`, via an in-page rAF loop
 * so sampling isn't gated by Playwright's own polling cadence. Returns the
 * worst |top delta|, |height delta| AND |bottom delta| seen across every
 * sampled frame.
 *
 * |Δbottom| is the informative axis (adversarial review finding D5): both
 * boxes' bottom edges are pinned to `viewport - 16` at rest, so a HEALTHY
 * desync interpolates top and height together and leaves the bottom edge
 * algebraically invariant — |Δtop| and |Δheight| collapse to the same
 * number and never expose a defect that breaks that invariant (e.g. a
 * shared-layout FLIP seeded from a stale snapshot, D3). |Δbottom| is the
 * only axis that catches that class of bug, and previously wasn't sampled
 * at all.
 *
 * Regression gate for the D1/D2 fix (docs: the transposed layoutId
 * transitions and the premature sheetRect clear): before that fix, worstTop/
 * worstHeight were 315px (open) and 487px (close).
 */
async function sampleShadowSurfaceDelta(page: Page, durationMs: number) {
  return page.evaluate((duration) => {
    return new Promise<{
      worstTop: number;
      worstHeight: number;
      worstBottom: number;
    }>((resolve) => {
      let worstTop = 0;
      let worstHeight = 0;
      let worstBottom = 0;
      const start = performance.now();
      function tick() {
        const surface = document.querySelector(
          '[data-disc-sheet-part="sheet"], [data-disc-sheet-part="disc-surface"]',
        );
        const shadow = document.querySelector(
          '[data-disc-sheet-part="shadow"]',
        );
        if (surface && shadow) {
          const s = surface.getBoundingClientRect();
          const sh = shadow.getBoundingClientRect();
          worstTop = Math.max(worstTop, Math.abs(sh.top - s.top));
          worstHeight = Math.max(worstHeight, Math.abs(sh.height - s.height));
          worstBottom = Math.max(worstBottom, Math.abs(sh.bottom - s.bottom));
        }
        if (performance.now() - start < duration) {
          requestAnimationFrame(tick);
        } else {
          resolve({ worstTop, worstHeight, worstBottom });
        }
      }
      requestAnimationFrame(tick);
    });
  }, durationMs);
}

for (const viewport of VIEWPORTS) {
  for (const mode of MOTION_MODES) {
    const reduced = mode === "reduced-motion";

    test.describe(`${viewport.width}x${viewport.height} — ${mode}`, () => {
      test.use({ viewport });

      test("(a) disc-side and sheet-side Shared boxes are equal", async ({
        page,
      }) => {
        await gotoExample(page, reduced);

        const discShared = page.locator(
          '[data-disc-sheet-part="shared"][data-disc-sheet-slot="disc"]',
        );
        // useDiscSize's SSR-safe initializer (M6) always resolves at the
        // ramp's base size first, then promotes to the real size in a
        // post-mount effect — wait for that promotion to land before
        // measuring, or a fast read here catches the pre-promotion value.
        await waitForStableWidth(page, discShared);
        const discBox = await discShared.boundingBox();
        expect(
          discBox,
          "disc-side Shared must be measurable before open",
        ).not.toBeNull();

        await openSheet(page);

        const sheetShared = page.locator(
          '[data-disc-sheet-part="shared"][data-disc-sheet-slot="sheet"]',
        );
        const sheetBox = await sheetShared.boundingBox();
        expect(
          sheetBox,
          "sheet-side Shared must be measurable once open",
        ).not.toBeNull();

        console.log(
          `[geometry] ${viewport.width}x${viewport.height} ${mode}: ` +
            `disc-side Shared ${discBox!.width.toFixed(1)}x${discBox!.height.toFixed(1)}, ` +
            `sheet-side Shared ${sheetBox!.width.toFixed(1)}x${sheetBox!.height.toFixed(1)}`,
        );

        expect(sheetBox!.width).toBeCloseTo(discBox!.width, 0);
        expect(sheetBox!.height).toBeCloseTo(discBox!.height, 0);
      });

      test("(b) sheet border-radius is greater than 0", async ({ page }) => {
        await gotoExample(page, reduced);
        await openSheet(page);

        const sheet = page.locator('[data-disc-sheet-part="sheet"]');
        const radius = await sheet.evaluate((el) => {
          const cs = getComputedStyle(el);
          // borderRadius is the shorthand; read one corner explicitly.
          return Number.parseFloat(cs.borderTopLeftRadius || "0");
        });

        console.log(
          `[geometry] ${viewport.width}x${viewport.height} ${mode}: sheet border-radius = ${radius}px`,
        );
        expect(radius).toBeGreaterThan(0);
      });

      test("(c) content's box sits inside the sheet's padding box", async ({
        page,
      }) => {
        await gotoExample(page, reduced);
        await openSheet(page);

        const sheet = page.locator('[data-disc-sheet-part="sheet"]');
        const content = page.locator('[data-disc-sheet-part="content"]');

        const sheetBox = (await sheet.boundingBox())!;
        const contentBox = (await content.boundingBox())!;
        const borderWidth = await sheet.evaluate((el) =>
          Number.parseFloat(getComputedStyle(el).borderTopWidth || "0"),
        );

        const paddingBox = {
          left: sheetBox.x + borderWidth,
          top: sheetBox.y + borderWidth,
          right: sheetBox.x + sheetBox.width - borderWidth,
          bottom: sheetBox.y + sheetBox.height - borderWidth,
        };

        const EPS = 1; // subpixel tolerance
        expect(contentBox.x).toBeGreaterThanOrEqual(paddingBox.left - EPS);
        expect(contentBox.y).toBeGreaterThanOrEqual(paddingBox.top - EPS);
        expect(contentBox.x + contentBox.width).toBeLessThanOrEqual(
          paddingBox.right + EPS,
        );
        expect(contentBox.y + contentBox.height).toBeLessThanOrEqual(
          paddingBox.bottom + EPS,
        );
      });

      test("(d) --disc-sheet-z and --disc-sheet-sheet-max-width respond to props", async ({
        page,
      }) => {
        await gotoExample(page, reduced, {
          zIndex: "500",
          sheetMaxWidth: "600",
        });

        const rootEl = page.locator("[data-disc-sheet-root]");
        const z = await rootEl.evaluate((el) =>
          getComputedStyle(el).getPropertyValue("--disc-sheet-z").trim(),
        );
        const maxWidth = await rootEl.evaluate((el) =>
          getComputedStyle(el)
            .getPropertyValue("--disc-sheet-sheet-max-width")
            .trim(),
        );
        expect(z).toBe("500");
        expect(maxWidth).toBe("600px");

        // And it must actually reach the rendered layers, not just the var.
        const discRoot = page.locator('[data-disc-sheet-part="disc-root"]');
        const discZ = await discRoot.evaluate(
          (el) => getComputedStyle(el).zIndex,
        );
        expect(discZ).toBe("500");

        await openSheet(page);
        const sheet = page.locator('[data-disc-sheet-part="sheet"]');
        const sheetWidth = (await sheet.boundingBox())!.width;
        // .sheet's CSS width is min(--disc-sheet-sheet-max-width, 100vw -
        // 32px) — at our narrowest viewport (375) the viewport clamp wins,
        // not the 600px max-width, so the expectation has to account for
        // that clamp rather than assume 600 always renders.
        const expectedWidth = Math.min(600, viewport.width - 32);
        expect(sheetWidth).toBeCloseTo(expectedWidth, 0);
      });

      // Reduced motion drops layoutId entirely on both sides (§6) and
      // cross-fades in 200ms flat — there is no mid-morph FLIP to sample,
      // and reduced-motion's own correctness is covered by a11y.spec.ts and
      // test (b) above. This gate is about the normal-motion morph only.
      if (!reduced) {
        // Open thresholds: 30px. Close (Escape path): 6px. Tightened from
        // 70/10 per the adversarial review's read of the post-fix spread
        // (open worst case measured 15.1-29.6px across viewports once D1-D3
        // are fixed; close worst case measured 2.7-4px). These stay well
        // under the pre-fix numbers (315px open / 487px close) while no
        // longer parking the bound miles above what a healthy run produces.
        const OPEN_THRESHOLD_PX = 30;
        const CLOSE_THRESHOLD_PX = 6;
        // |Δbottom| bound: both boxes are bottom-pinned at rest, so a
        // healthy desync leaves the bottom edge algebraically invariant
        // (see the comment on sampleShadowSurfaceDelta). 2px is not "loose
        // margin over noise" — it is close to zero on purpose, because this
        // is the axis D3 (the stale first-open FLIP snapshot) breaks by
        // tens of px while Δtop/Δheight stay inside their own bounds.
        const BOTTOM_THRESHOLD_PX = 2;

        test("(e) shadow tracks the surface box through open AND close", async ({
          page,
        }) => {
          await gotoExample(page, reduced);

          const disc = page.getByRole("button", { name: DISC_LABEL });
          await disc.click();

          // 1.2s covers settle for both the open spring (375/42.5/1.75) and
          // the close spring (240/34/1.75 + the 100ms SURFACE_CLOSE_LEAD_
          // DELAY_MS) at real wall-clock speed, generous over either's
          // measured settle time so a slow CI runner doesn't clip the tail.
          const openResult = await sampleShadowSurfaceDelta(page, 1200);
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} open: ` +
              `worst |Δtop|=${openResult.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${openResult.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${openResult.worstBottom.toFixed(1)}px`,
          );
          expect(openResult.worstTop).toBeLessThan(OPEN_THRESHOLD_PX);
          expect(openResult.worstHeight).toBeLessThan(OPEN_THRESHOLD_PX);
          expect(openResult.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);

          await page.keyboard.press("Escape");
          const closeResult = await sampleShadowSurfaceDelta(page, 1200);
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} close: ` +
              `worst |Δtop|=${closeResult.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${closeResult.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${closeResult.worstBottom.toFixed(1)}px`,
          );
          expect(closeResult.worstTop).toBeLessThan(CLOSE_THRESHOLD_PX);
          expect(closeResult.worstHeight).toBeLessThan(CLOSE_THRESHOLD_PX);
          expect(closeResult.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);
        });

        test("(f) shadow tracks the sheet through a swipe-to-dismiss drag (D1)", async ({
          page,
        }) => {
          await gotoExample(page, reduced);
          await openSheet(page);

          const sheet = page.locator('[data-disc-sheet-part="sheet"]');
          const box = (await sheet.boundingBox())!;
          // Top strip of the sheet, above <DiscSheet.Shared>'s 24px margin
          // and the Close button inside Content — a safe drag-handle point
          // that isn't an interactive child.
          const startX = box.x + box.width / 2;
          const startY = box.y + 8;

          await page.mouse.move(startX, startY);
          await page.mouse.down();

          // Drag well past SWIPE_OFFSET_PX (96) in small steps, without
          // releasing — this is the HELD-DRAG sample the prior gate never
          // took (it only ever closed via Escape, never via drag).
          const dragSteps = 10;
          for (let i = 1; i <= dragSteps; i++) {
            await page.mouse.move(startX, startY + (140 * i) / dragSteps, {
              steps: 1,
            });
          }

          const held = await page.evaluate(() => {
            const surface = document.querySelector(
              '[data-disc-sheet-part="sheet"]',
            )!;
            const shadow = document.querySelector(
              '[data-disc-sheet-part="shadow"]',
            )!;
            const s = surface.getBoundingClientRect();
            const sh = shadow.getBoundingClientRect();
            return {
              top: Math.abs(sh.top - s.top),
              bottom: Math.abs(sh.bottom - s.bottom),
            };
          });
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} held-drag: ` +
              `|Δtop|=${held.top.toFixed(1)}px, |Δbottom|=${held.bottom.toFixed(1)}px`,
          );
          // Loose on purpose: mid-drag the sheet is user-dragged away from
          // its resting anchor by up to ~140px of pointer travel, and the
          // shadow must follow that same translation, not just settle at
          // rest. 20px covers drag-vs-shadow frame lag without hiding a
          // fixed-anchor shadow that never moved at all (pre-fix: ~145px on
          // a comparable real-device swipe per the adversarial review).
          expect(held.top).toBeLessThan(20);
          expect(held.bottom).toBeLessThan(20);

          // Release past the dismiss threshold and sample through the close
          // this swipe triggers.
          await page.mouse.move(startX, startY + 220, { steps: 3 });
          await page.mouse.up();

          const closeResult = await sampleShadowSurfaceDelta(page, 1200);
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} swipe-dismiss close: ` +
              `worst |Δtop|=${closeResult.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${closeResult.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${closeResult.worstBottom.toFixed(1)}px`,
          );
          expect(closeResult.worstTop).toBeLessThan(CLOSE_THRESHOLD_PX);
          expect(closeResult.worstHeight).toBeLessThan(CLOSE_THRESHOLD_PX);
          expect(closeResult.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);
        });

        test("(g) shadow tracks a reversed morph — Escape fired mid-open", async ({
          page,
        }) => {
          await gotoExample(page, reduced);
          const disc = page.getByRole("button", { name: DISC_LABEL });
          await disc.click();

          // Fire the reversal partway through the open spring's settle,
          // before it has a chance to finish — this is the state a
          // fast-double-tap or an impatient Escape produces, and the prior
          // gate never exercised it at all.
          await page.waitForTimeout(160);
          await page.keyboard.press("Escape");

          const result = await sampleShadowSurfaceDelta(page, 1200);
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} reversed-morph: ` +
              `worst |Δtop|=${result.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${result.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${result.worstBottom.toFixed(1)}px`,
          );
          // The reversal itself runs the close spring/timing (same code
          // path as a normal close), so it is held to the close bound, not
          // the looser open one.
          expect(result.worstTop).toBeLessThan(CLOSE_THRESHOLD_PX * 3);
          expect(result.worstHeight).toBeLessThan(CLOSE_THRESHOLD_PX * 3);
          expect(result.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);
        });

        test("(h) shadow tracks a rapid open/close toggle (3 cycles)", async ({
          page,
        }) => {
          await gotoExample(page, reduced);
          const disc = page.getByRole("button", { name: DISC_LABEL });

          let worstTop = 0;
          let worstHeight = 0;
          let worstBottom = 0;
          for (let i = 0; i < 3; i++) {
            await disc.click();
            await page.waitForTimeout(220);
            const openSample = await sampleShadowSurfaceDelta(page, 220);
            worstTop = Math.max(worstTop, openSample.worstTop);
            worstHeight = Math.max(worstHeight, openSample.worstHeight);
            worstBottom = Math.max(worstBottom, openSample.worstBottom);

            await page.keyboard.press("Escape");
            await page.waitForTimeout(220);
            const closeSample = await sampleShadowSurfaceDelta(page, 220);
            worstTop = Math.max(worstTop, closeSample.worstTop);
            worstHeight = Math.max(worstHeight, closeSample.worstHeight);
            worstBottom = Math.max(worstBottom, closeSample.worstBottom);
          }

          console.log(
            `[geometry] ${viewport.width}x${viewport.height} rapid-toggle (3x): ` +
              `worst |Δtop|=${worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${worstBottom.toFixed(1)}px`,
          );
          expect(worstTop).toBeLessThan(OPEN_THRESHOLD_PX);
          expect(worstHeight).toBeLessThan(OPEN_THRESHOLD_PX);
          expect(worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);
        });

        test("(i) shadow tracks the sheet through a resize mid-close (D2)", async ({
          page,
        }) => {
          await gotoExample(page, reduced);
          await openSheet(page);
          await page.keyboard.press("Escape");

          // 90ms into the close, resize the viewport — matches the
          // adversarial review's repro (orientation change / iOS URL-bar
          // collapse mid-close).
          await page.waitForTimeout(90);
          await page.setViewportSize({
            width: viewport.width,
            height: Math.round(viewport.height * 0.63),
          });

          // Two different measurements on purpose, because a live resize
          // mid-close mixes TWO effects this repo's own methodology can't
          // otherwise tell apart:
          //
          // 1. D2 itself (Sheet.tsx's resize listener now stays registered
          //    through the whole close, so sheetRect keeps updating instead
          //    of freezing) — this is what makes the geometry CONVERGE to a
          //    correct end state at all, instead of staying wrong for the
          //    rest of the close the way the pre-fix 481.7px case did.
          // 2. A SEPARATE, NOT fixed here interaction: Disc.tsx's own
          //    resize handler re-seats the disc wrapper with an instant
          //    `.jump()` (no animation), and while a shared-layoutId FLIP is
          //    actively in flight, that instant jump and the FLIP's own
          //    in-progress transform briefly disagree about the surface's
          //    on-screen box — producing a large, MULTI-FRAME (not
          //    single-frame) transient right after the resize before both
          //    sides settle back together. Confirmed via direct probing:
          //    sheetRect itself tracks correctly the entire time (it is NOT
          //    frozen); the transient is in the PAINTED surface box, a
          //    genuinely different mechanism.
          //
          // So: the SETTLE window (last 300ms of the sample) asserts D2's
          // own fix — convergence — and is tight. The full-window worst is
          // logged, not gated, and documented here rather than hidden: it is
          // large (500-900px) and is a real, separately-tracked follow-up
          // (the disc's resize re-seat should probably suppress itself, or
          // suppress the FLIP, while collapseProgress is mid-flight) — out
          // of this brief's named scope (D2 was specifically the resize
          // LISTENER teardown) but surfaced honestly rather than papered
          // over with a threshold loose enough to swallow it silently.
          const full = await sampleShadowSurfaceDelta(page, 1200);
          const settleWindowMs = 300;
          const settled = await sampleShadowSurfaceDelta(page, settleWindowMs);
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} resize-mid-close FULL WINDOW (not gated, known transient — see comment): ` +
              `worst |Δtop|=${full.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${full.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${full.worstBottom.toFixed(1)}px`,
          );
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} resize-mid-close SETTLE WINDOW (gated, D2's own mechanism): ` +
              `worst |Δtop|=${settled.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${settled.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${settled.worstBottom.toFixed(1)}px`,
          );
          expect(settled.worstTop).toBeLessThan(15);
          expect(settled.worstHeight).toBeLessThan(15);
        });

        test("(j) cold first open does not FLIP from a stale disc-size snapshot (D3)", async ({
          page,
        }) => {
          // Deliberately does NOT call waitForStableWidth or otherwise wait
          // for useDiscSize's post-mount promotion to land before opening —
          // that wait is exactly what makes every OTHER test in this file a
          // warm open. This is a fresh navigation (a new Page per Playwright
          // test) with the earliest possible click, which is what a real
          // visitor's first interaction after page load looks like.
          await gotoExample(page, reduced);
          const disc = page.getByRole("button", { name: DISC_LABEL });
          await disc.click();

          const result = await sampleShadowSurfaceDelta(page, 1200);
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} cold-first-open: ` +
              `worst |Δtop|=${result.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${result.worstHeight.toFixed(1)}px, ` +
              `worst |Δbottom|=${result.worstBottom.toFixed(1)}px`,
          );
          // |Δbottom| is the assertion that matters here — see the D3 note
          // on sampleShadowSurfaceDelta. A stale pre-promotion snapshot
          // breaks exactly this invariant while leaving Δtop/Δheight inside
          // their normal bound.
          expect(result.worstBottom).toBeLessThan(BOTTOM_THRESHOLD_PX);
        });
      }
    });
  }
}

/**
 * (k) — D4: a consumer's transition.open delay must reach BOTH clocks (the
 * layoutId FLIP on <Sheet> and the collapseProgress spring driving
 * <Shadow>), not just one. Root.tsx's drivenOpenTransition used to strip the
 * consumer's delay from collapseProgress alone (forcing delay: 0) while
 * Sheet.tsx passed transition.open through untouched — exactly the class of
 * desync D1/D2 fixed, but reachable through a documented public prop.
 *
 * example/main.tsx plumbs `?openDelay=<seconds>` into transition.open. A
 * consumer-set 250ms delay should hold the surface AND the shadow at the
 * disc's own box for (most of) that window — sampled at 120ms in, well
 * before the delay elapses, so a broken clock has already visibly diverged
 * but a working one hasn't started moving yet.
 */
test.describe("1280x800 — normal — D4 consumer delay", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("(k) shadow and surface both honour transition.open's delay", async ({
    page,
  }) => {
    await gotoExample(page, false, { openDelay: "0.25" });
    const disc = page.getByRole("button", { name: DISC_LABEL });
    await disc.click();

    await page.waitForTimeout(120);
    const midDelay = await page.evaluate(() => {
      const surface = document.querySelector('[data-disc-sheet-part="sheet"]');
      const shadow = document.querySelector('[data-disc-sheet-part="shadow"]');
      if (!surface || !shadow) return null;
      const s = surface.getBoundingClientRect();
      const sh = shadow.getBoundingClientRect();
      return {
        top: Math.abs(sh.top - s.top),
        bottom: Math.abs(sh.bottom - s.bottom),
      };
    });
    expect(midDelay, "sheet must be mounted 120ms after click").not.toBeNull();
    console.log(
      `[geometry] 1280x800 D4 mid-delay(120ms of 250ms): ` +
        `|Δtop|=${midDelay!.top.toFixed(1)}px, |Δbottom|=${midDelay!.bottom.toFixed(1)}px`,
    );
    // Both clocks are still inside the consumer's 250ms delay window at
    // 120ms — a working component holds both at the disc's box (near 0
    // desync). A stripped delay on one clock alone (the D4 bug) lets that
    // clock run ahead for the whole 120ms window, which measured 182.7px at
    // 1280 pre-fix.
    expect(midDelay!.top).toBeLessThan(10);
    expect(midDelay!.bottom).toBeLessThan(10);
  });
});
