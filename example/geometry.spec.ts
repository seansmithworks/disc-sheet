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
 * FIXED — Defect 3 (stale first-open shared-layoutId snapshot). Tests (e),
 * (j), and (k) are green. FIVE candidate fixes were tried and rejected
 * first (see git history for the full writeup that used to live here); all
 * five tried to make Motion RE-snapshot the box AFTER JS promoted
 * `discSize` from its SSR-safe base value: gating `layoutId` on a "settled"
 * flag, remounting via `key`, a synthetic `resize` event, `flushSync`-ing
 * the promotion, and moving promotion to `useLayoutEffect`. All five were
 * on the wrong axis — Motion snapshots the element's real DOM box at first
 * paint, not React state, so nothing that fires AFTER that paint can help.
 *
 * Isolation evidence that pointed at the real axis: sampling
 * `?openDelay=0.25` at 120ms (nothing animating yet, so no spring blur) gave
 * |Δbottom| = 0.0 / 32.0 / 48.0 at 375/1280/1700 — EXACTLY the ramp's
 * promotion delta (128−96=32, 144−96=48), and |Δtop| stayed 0.0 throughout
 * (the two boxes share a pinned bottom edge; see
 * reference_pinned-bottoms-collapse-dtop-and-dheight-into-one-
 * assertion). That means the disc-side shared element was being PAINTED at
 * the base size on the real (non-base) viewport, not just measured wrong.
 *
 * The fix: make the first-paint box CORRECT instead of chasing a
 * re-snapshot. `useDiscSize`'s JS value still resolves at vpW=0 on first
 * render (still needed for hydration-safe position math in anchors.ts), but
 * it no longer sizes any FLIP-tracked element. Root.tsx now renders a
 * scoped `<style>` block with real `@media` rules for
 * `--disc-sheet-disc-size`, derived from `resolveDiscSize` (the ramp's one
 * source of truth) at the ramp's own breakpoints. A real `@media` query
 * resolves correctly in the browser before any script runs, so there is
 * never a stale value for Motion to snapshot in the first place. Neither
 * Root.tsx's wrapper nor Disc.tsx's drag wrapper write
 * `--disc-sheet-disc-size` inline anymore — an inline write on either would
 * have kept beating the `<style>` block's `@media` rules regardless of
 * viewport, which is why Disc.tsx's drag wrapper (an ANCESTOR of the
 * disc-side `.shared`) needed the same change as Root.tsx, not just one of
 * the two.
 *
 * (g) is a SEPARATE, still-unfixed defect (reversed morph — Escape fired
 * mid-open) and stays red on purpose: it fails at all three viewports,
 * including 375px where no disc-size promotion ever happens, so it cannot
 * be D3. Leave it red; do not "helpfully" chase it here.
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

      // Audit M11: the backdrop used to survive the whole close (rendered
      // inside AnimatePresence's `{open && ...}` child, so it stayed mounted
      // at zIndex + 101 — above the disc's zIndex 100 — for the entire exit
      // animation), eating every click over the disc's resting position for
      // as long as the close took to settle. Both motion modes render a
      // close (reduced motion just skips the FLIP, not the backdrop's own
      // mount lifecycle), so this gate isn't scoped to `!reduced` like the
      // FLIP-sampling gates below it.
      test("(l) a click over the disc's resting position reaches the disc, not the backdrop, 300ms into a close (M11)", async ({
        page,
      }) => {
        await gotoExample(page, reduced);
        const disc = page.getByRole("button", { name: DISC_LABEL });
        const discBox = (await disc.boundingBox())!;
        const cx = discBox.x + discBox.width / 2;
        const cy = discBox.y + discBox.height / 2;

        await disc.click();
        const sheet = page.locator('[data-disc-sheet-part="sheet"]');
        await sheet.waitFor();
        await waitForStableWidth(page, sheet);

        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);

        const hitPart = await page.evaluate(
          ([x, y]) => {
            const el = document.elementFromPoint(x, y);
            return (
              el
                ?.closest("[data-disc-sheet-part]")
                ?.getAttribute("data-disc-sheet-part") ?? null
            );
          },
          [cx, cy],
        );
        console.log(
          `[geometry] ${viewport.width}x${viewport.height} ${mode}: ` +
            `300ms-into-close elementFromPoint(disc resting position) part=${hitPart}`,
        );
        expect(hitPart).not.toBe("backdrop");
      });

      // Reduced motion drops layoutId entirely on both sides (§6) and
      // cross-fades in 200ms flat — there is no mid-morph FLIP to sample,
      // and reduced-motion's own correctness is covered by a11y.spec.ts and
      // test (b) above. This gate is about the normal-motion morph only.
      if (!reduced) {
        // Open thresholds: 8px. Close (Escape path): 6px. The open bound was
        // 30px, which only ever passed because it was set from a measured
        // spread (15.1-29.6px) that was itself the M2 defect — the shadow
        // clock and Motion's layout-projection clock starting from two
        // different timestamps. With those two clocks structurally coupled
        // (Root.tsx's startMorphClock, fired from Motion's own
        // onLayoutAnimationStart), a healthy open measures 0.1-0.4px worst
        // |Δtop| on both example pages at 390x844 and 1280x800. 8px is
        // therefore ~20x the observed spread, not a margin over it: it is
        // low enough that any reappearance of a start-time offset — even a
        // single frame of one — fails here rather than passing quietly.
        const OPEN_THRESHOLD_PX = 8;
        const CLOSE_THRESHOLD_PX = 6;
        // |Δbottom| bound: both boxes are bottom-pinned at rest, so a
        // healthy desync leaves the bottom edge algebraically invariant
        // (see the comment on sampleShadowSurfaceDelta). 2px is not "loose
        // margin over noise" — it is close to zero on purpose, because this
        // is the axis D3 (the stale first-open FLIP snapshot) breaks by
        // tens of px while Δtop/Δheight stay inside their own bounds.
        const BOTTOM_THRESHOLD_PX = 2;
        // (h)-only: 3 rapid open/close cycles compound spring settle noise
        // on the shared bottom-pinned edge in a way the single-transition
        // tests above don't. Sampled 37x locally (27 idle + 10 under
        // synthetic `yes`-process CPU load) at 1700x1000: worstBottom was
        // 0.0px every single time. But this bound has independently been
        // measured at 2.09px and 2.20px on other runs/machines — evidence
        // this is real cross-machine spring-timing spread under load this
        // machine didn't reproduce, not noise to explain away. 4px sits
        // ~1.8px above the highest documented outlier (headroom for
        // machines slower than any sampled so far) while staying an order
        // of magnitude under the tens-of-px D3 defect this axis exists to
        // catch. Scoped to (h) only — the shared BOTTOM_THRESHOLD_PX above
        // stays tight for (e)/(f)/(g)/(j), which don't compound cycles.
        const RAPID_TOGGLE_BOTTOM_THRESHOLD_PX = 4;

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

        // Same gate as (e), on the OTHER example page. The M2 clock desync
        // scaled with how much work a page's open commit did, so it was 3-4x
        // worse on the flagship (a photo, a five-row nav, a real type ramp)
        // than on the generic example (e) samples — 58-74px vs 18-21px worst
        // |Δtop| at the same viewports. A gate that only ever opens the
        // lightest page in the repo cannot see that class of regression at
        // all, which is exactly how a 30px bound came to look reasonable.
        test("(m) shadow tracks the flagship example's surface through open AND close", async ({
          page,
        }) => {
          await page.goto("/flagship.html");
          await page.waitForSelector('[data-disc-sheet-part="disc-trigger"]');
          // The flagship's text faces are used ONLY inside its sheet, so they
          // are still unloaded when the disc is tapped and the swap re-lays
          // the sheet out mid-morph (measured at 390x844: 592 -> 618px tall,
          // ~40ms in). Shadow.tsx re-measures and both clocks restart
          // together when that happens, but Motion's own projection paints
          // one frame against the pre-relayout transform, and that frame is
          // the example page's font strategy talking, not the package's
          // clock. Load the faces first so this gate measures the morph.
          await page.evaluate(() =>
            Promise.all([...document.fonts].map((f) => f.load())),
          );
          await waitForStableWidth(
            page,
            page.locator('[data-disc-sheet-part="disc-trigger"]'),
          );

          await page.locator('[data-disc-sheet-part="disc-trigger"]').click();
          const openResult = await sampleShadowSurfaceDelta(page, 1200);
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} flagship open: ` +
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
            `[geometry] ${viewport.width}x${viewport.height} flagship close: ` +
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
          // Was: "the reversal runs the close spring/timing (same code path
          // as a normal close)". That was never true, and the pre-fix
          // numbers prove it — worstTop measured 26-37px here vs. 2.7-4px
          // for an actual close (e). The real cause: collapseProgress's
          // animate() call inherited the in-flight open animation's
          // velocity by default (motion-dom's animateMotionValue defaults to
          // value.getVelocity()), while Motion's own layout-projection
          // spring — the one actually moving the shared-layoutId surface —
          // unconditionally restarts its internal progress value at
          // velocity 0 on every animation, reversal or not
          // (motion-dom's create-projection-node.mjs startAnimation:
          // `jump(0, false)` then `animateSingleValue(..., { velocity: 0
          // })`). Two clocks starting a reversal from different velocities
          // diverge. Root.tsx's collapseProgress animate() calls now pass
          // an explicit `velocity: 0` on both the open and close branches to
          // match — sampled 26x across all three viewports post-fix:
          // worstTop 5.7-11.9px. That is a real fix (26-37px -> 5.7-11.9px),
          // but it only aligned the two clocks' STARTING velocity, not their
          // spring constants, so a reversal still settles a few px above
          // what a fresh close (e) achieves (2.7-4px) — hence this stays at
          // CLOSE_THRESHOLD_PX * 3, not CLOSE_THRESHOLD_PX itself.
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
          expect(worstBottom).toBeLessThan(RAPID_TOGGLE_BOTTOM_THRESHOLD_PX);
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
          // 2. A residual, KNOWN AND ACCEPTED transient, now much smaller
          //    than it was: Disc.tsx's resize handler used to re-seat the
          //    disc wrapper with an instant `.jump()` even while a shared-
          //    layoutId FLIP was in flight — that ancestor-transform jump
          //    compounded with the FLIP's own in-progress transform on its
          //    child (disc-surface), producing an 868–869px worst-case
          //    (375/1280/1700: 868–869 / 586–587 / 651–653px, three runs).
          //    Fixed: the handler now defers the re-seat (pendingResizeRef)
          //    until Sheet's onExitComplete nulls sheetRect, matching the
          //    onExitComplete pattern already established for sheetRect's
          //    own release. That cut the worst case by ~60–70% (three runs,
          //    375/1280/1700: 298–299 / 294–295 / 367–369px) but did not
          //    zero it, because a SEPARATE, structurally different
          //    mechanism remains: this test's queried "surface" (the actual
          //    disc-surface/sheet DOM box) reflows natively and
          //    synchronously the instant the viewport resizes, while
          //    Shadow.tsx's silhouette is driven by `sheetRect`, which is
          //    D2's OWN tracking value — plumbed through React state, one
          //    render tick behind the native reflow by construction.
          //    Removing that lag would mean making sheetRect update
          //    synchronously with the resize event, which touches the exact
          //    mechanism D2 fixed and is out of this test's bounds. worst
          //    |Δheight| stays ~2.5–4px throughout (both boxes keep the
          //    right SIZE — this is a POSITION-only artifact, same
          //    signature as the fixed defect, opposite of D3).
          //
          // So: the SETTLE window (last 300ms of the sample) asserts D2's
          // own fix — convergence — and is tight. The FULL window is now
          // gated too, at a bound with real headroom over three stable
          // post-fix runs (worst observed 369px at 1700x1000): this is an
          // accepted, bounded artifact of resizing mid-morph, not an
          // unknown regression budget.
          const FULL_WINDOW_THRESHOLD_PX = 450;
          const full = await sampleShadowSurfaceDelta(page, 1200);
          const settleWindowMs = 300;
          const settled = await sampleShadowSurfaceDelta(page, settleWindowMs);
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} resize-mid-close FULL WINDOW (gated, known bounded transient — see comment): ` +
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
          expect(full.worstBottom).toBeLessThan(FULL_WINDOW_THRESHOLD_PX);
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

        // Audit M1: the close-morph ellipse. Disc.tsx's disc-surface used to
        // bind border-radius to a CSS `var()` STRING, which Motion can't
        // parse or scale-correct for a shared-layoutId crossfade — so the
        // computed border-radius on whichever element currently carries the
        // layoutId snapped to the literal 9999px fallback from frame one of
        // every close, painting a full ellipse on a sheet-sized box for the
        // whole collapse. Both crossfade participants (Sheet.tsx's `.sheet`
        // on open, Disc.tsx's `.discSurface` on close) now bind to the SAME
        // numeric collapseRadius MotionValue (useCollapseRadius.ts), so this
        // asserts the invariant a healthy close must never break: while the
        // box is still sheet-sized (width > 200px — comfortably above the
        // disc's own resting diameter, which is under 150px at every ramp
        // breakpoint), its border-radius can never exceed a plain rounded
        // rectangle's max (min(width, height) / 2) the way an ellipse does.
        test("(k) close-morph border-radius never balloons into an ellipse while the box is still sheet-sized (M1)", async ({
          page,
        }) => {
          await gotoExample(page, reduced);
          await openSheet(page);
          await page.keyboard.press("Escape");

          const result = await page.evaluate((duration) => {
            return new Promise<{ worstExcessPx: number; samples: number }>(
              (resolve) => {
                let worstExcessPx = 0;
                let samples = 0;
                const start = performance.now();
                function tick() {
                  const el = document.querySelector(
                    '[data-disc-sheet-part="sheet"], [data-disc-sheet-part="disc-surface"]',
                  );
                  if (el) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 200) {
                      const radius = Number.parseFloat(
                        getComputedStyle(el).borderTopLeftRadius || "0",
                      );
                      const maxAllowed = Math.min(rect.width, rect.height) / 2;
                      samples += 1;
                      worstExcessPx = Math.max(
                        worstExcessPx,
                        radius - maxAllowed,
                      );
                    }
                  }
                  if (performance.now() - start < duration) {
                    requestAnimationFrame(tick);
                  } else {
                    resolve({ worstExcessPx, samples });
                  }
                }
                requestAnimationFrame(tick);
              },
            );
          }, 1200);

          console.log(
            `[geometry] ${viewport.width}x${viewport.height} close border-radius: ` +
              `worst excess over min(w,h)/2 = ${result.worstExcessPx.toFixed(1)}px ` +
              `across ${result.samples} samples with width>200px`,
          );
          expect(result.samples).toBeGreaterThan(0);
          expect(result.worstExcessPx).toBeLessThanOrEqual(0.5);
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
