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
 * worst |top delta| and |height delta| seen across every sampled frame —
 * this is the regression gate for the D1/D2 fix (docs: the transposed
 * layoutId transitions and the premature sheetRect clear): before that fix,
 * these two numbers were 315px (open) and 487px (close).
 */
async function sampleShadowSurfaceDelta(page: Page, durationMs: number) {
  return page.evaluate((duration) => {
    return new Promise<{ worstTop: number; worstHeight: number }>((resolve) => {
      let worstTop = 0;
      let worstHeight = 0;
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
        }
        if (performance.now() - start < duration) {
          requestAnimationFrame(tick);
        } else {
          resolve({ worstTop, worstHeight });
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
              `worst |Δheight|=${openResult.worstHeight.toFixed(1)}px`,
          );

          // Thresholds: the shadow (Shadow.tsx) and the surface box
          // (Sheet.tsx / Disc.tsx) are updated on two independent paths —
          // Motion's own projection engine drives the surface FLIP, while a
          // `collapseProgress.on("change", …)` subscription writes the
          // shadow's geometry as plain styles. On open (no configured
          // delay), that leaves roughly a 1-frame scheduling gap between
          // React's passive-effect timing (which starts the collapseProgress
          // spring) and Motion's own layout-effect timing (which starts the
          // FLIP), and 1 frame of a fast-moving spring covers more distance
          // at larger viewports — measured worst case is 15.1px Δtop /
          // 54.1px Δheight at 1700px. On close, SURFACE_CLOSE_LEAD_DELAY_MS
          // re-anchors both clocks to the same delayed start and the gap
          // nearly disappears — measured worst case 2.7px / 2.7px. Both are
          // one to two orders of magnitude under the pre-fix numbers (315px
          // open / 487px close), so 70 / 10 gives real margin over the
          // measured worst case while still catching a regression back
          // toward "two different springs" territory.
          const OPEN_THRESHOLD_PX = 70;
          const CLOSE_THRESHOLD_PX = 10;
          expect(openResult.worstTop).toBeLessThan(OPEN_THRESHOLD_PX);
          expect(openResult.worstHeight).toBeLessThan(OPEN_THRESHOLD_PX);

          await page.keyboard.press("Escape");
          const closeResult = await sampleShadowSurfaceDelta(page, 1200);
          console.log(
            `[geometry] ${viewport.width}x${viewport.height} close: ` +
              `worst |Δtop|=${closeResult.worstTop.toFixed(1)}px, ` +
              `worst |Δheight|=${closeResult.worstHeight.toFixed(1)}px`,
          );
          expect(closeResult.worstTop).toBeLessThan(CLOSE_THRESHOLD_PX);
          expect(closeResult.worstHeight).toBeLessThan(CLOSE_THRESHOLD_PX);
        });
      }
    });
  }
}
