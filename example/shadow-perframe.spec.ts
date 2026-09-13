import { test, expect } from "@playwright/test";

/**
 * shadow-perframe.spec.ts — regression gate for the per-frame double-read
 * / double-write defect a review found on `ea86163` in `src/Shadow.tsx`:
 * the MutationObserver on the surface's style attribute was connected for
 * the component's WHOLE lifetime, so it re-ran `apply()` on every frame of
 * the morph, not just the post-settle grace window it exists for.
 * `collapseProgress.on("change")` already runs `apply()` every frame, so
 * `apply()` (and the forced-layout DOM read inside it,
 * `readRenderedCornerRadius`) ran twice per frame during the whole
 * inFlight/settle-grace window.
 *
 * Instrumentation is entirely test-side (page.addInitScript), never a
 * production hook: `Element.prototype.getBoundingClientRect` and
 * `window.getComputedStyle` are wrapped to count calls against the surface
 * element (`[data-vista-sheet-part="sheet"]` /
 * `[data-vista-sheet-part="trigger-surface"]`), and a MutationObserver
 * counts style-attribute writes to the shadow element
 * (`[data-vista-sheet-part="shadow"]`) — both tallied into per-rAF-frame
 * buckets so "runs twice for one frame" is visible directly, without
 * relying on wall-clock sampling.
 */

const TRIGGER_LABEL = "Open example sheet";

async function installFrameCounters(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __surfaceRectReadsPerFrame: number[];
      __surfaceStyleReadsPerFrame: number[];
      __shadowWritesPerFrame: number[];
    };
    w.__surfaceRectReadsPerFrame = [];
    w.__surfaceStyleReadsPerFrame = [];
    w.__shadowWritesPerFrame = [];

    let rectReadsThisFrame = 0;
    let styleReadsThisFrame = 0;
    let shadowWritesThisFrame = 0;

    const SURFACE_SELECTOR =
      '[data-vista-sheet-part="sheet"], [data-vista-sheet-part="trigger-surface"]';

    function tick() {
      w.__surfaceRectReadsPerFrame.push(rectReadsThisFrame);
      w.__surfaceStyleReadsPerFrame.push(styleReadsThisFrame);
      w.__shadowWritesPerFrame.push(shadowWritesThisFrame);
      rectReadsThisFrame = 0;
      styleReadsThisFrame = 0;
      shadowWritesThisFrame = 0;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    const origRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (
      this: Element,
      ...args: unknown[]
    ) {
      if (this.matches?.(SURFACE_SELECTOR)) {
        rectReadsThisFrame++;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (origRect as any).apply(this, args);
    };

    const origComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function (
      elt: Element,
      ...rest: unknown[]
    ): CSSStyleDeclaration {
      if (elt instanceof Element && elt.matches?.(SURFACE_SELECTOR)) {
        styleReadsThisFrame++;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (origComputedStyle as any).call(window, elt, ...rest);
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const target = m.target as Element;
        if (
          m.type === "attributes" &&
          m.attributeName === "style" &&
          target.getAttribute?.("data-vista-sheet-part") === "shadow"
        ) {
          shadowWritesThisFrame++;
        }
      }
    });
    const arm = () => {
      observer.observe(document.documentElement, {
        subtree: true,
        attributes: true,
        attributeFilter: ["style"],
      });
    };
    if (document.documentElement) arm();
    else document.addEventListener("DOMContentLoaded", arm, { once: true });
  });
}

async function readCounters(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const w = window as unknown as {
      __surfaceRectReadsPerFrame: number[];
      __surfaceStyleReadsPerFrame: number[];
      __shadowWritesPerFrame: number[];
    };
    return {
      rect: w.__surfaceRectReadsPerFrame.slice(),
      style: w.__surfaceStyleReadsPerFrame.slice(),
      writes: w.__shadowWritesPerFrame.slice(),
    };
  });
}

test("(pf) Shadow: surface reads and shadow writes each run at most once per animation frame across open AND close", async ({
  page,
}) => {
  await installFrameCounters(page);
  await page.goto("/");
  await page.waitForSelector(
    '[data-vista-sheet-root="main"] [data-vista-sheet-part="trigger"]',
  );

  const trigger = page.getByRole("button", { name: TRIGGER_LABEL });
  await trigger.click();
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);

  const counters = await readCounters(page);

  const maxRect = Math.max(0, ...counters.rect);
  const maxStyle = Math.max(0, ...counters.style);
  const maxWrites = Math.max(0, ...counters.writes);

  expect(
    maxRect,
    `worst per-frame surface getBoundingClientRect() calls: ${JSON.stringify(counters.rect)}`,
  ).toBeLessThanOrEqual(1);
  expect(
    maxStyle,
    `worst per-frame surface getComputedStyle() calls: ${JSON.stringify(counters.style)}`,
  ).toBeLessThanOrEqual(1);
  expect(
    maxWrites,
    `worst per-frame shadow style writes: ${JSON.stringify(counters.writes)}`,
  ).toBeLessThanOrEqual(1);
});
