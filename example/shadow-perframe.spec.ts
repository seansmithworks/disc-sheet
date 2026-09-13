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
 *
 * Reads are attributed to Shadow specifically by inspecting the call
 * stack (`new Error().stack`) for `readRenderedCornerRadius`/`Shadow.tsx` —
 * `getBoundingClientRect` on the same surface element is also called by
 * Motion's OWN internal projection measurement (confirmed by stack trace:
 * `ProjectionNode.measure` / `measureViewportBox`), which is unrelated
 * engine behaviour, not the reported defect, and would otherwise produce
 * false-positive bursts (observed: 6 calls within 20ms at mount, none of
 * them from Shadow.tsx).
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

    // Scoped to the demo's primary sheet (`[data-vista-sheet-root="main"]`,
    // per geometry.spec.ts's own convention) — the page also renders a
    // second, independent VistaSheet.Root (the "Design" settings sheet)
    // whose own Shadow instance would otherwise add unrelated noise to a
    // global selector.
    const SURFACE_SELECTOR =
      '[data-vista-sheet-root="main"] [data-vista-sheet-part="sheet"], ' +
      '[data-vista-sheet-root="main"] [data-vista-sheet-part="trigger-surface"]';

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

    // Attributes a call to Shadow.tsx's own readRenderedCornerRadius/apply,
    // as opposed to any other consumer of getBoundingClientRect/
    // getComputedStyle on the same element (Motion's own projection
    // measurement chief among them — see the file doc comment).
    function isFromShadow(): boolean {
      const stack = new Error().stack ?? "";
      return (
        stack.includes("readRenderedCornerRadius") ||
        stack.includes("/Shadow.tsx")
      );
    }

    const origRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (
      this: Element,
      ...args: unknown[]
    ) {
      if (this.matches?.(SURFACE_SELECTOR) && isFromShadow()) {
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
      if (
        elt instanceof Element &&
        elt.matches?.(SURFACE_SELECTOR) &&
        isFromShadow()
      ) {
        styleReadsThisFrame++;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (origComputedStyle as any).call(window, elt, ...rest);
    };

    // One apply() call writes several DIFFERENT custom properties plus
    // width/height/left/top on the shadow element in a single synchronous
    // pass — Chromium does NOT coalesce those into one attribute mutation
    // record (confirmed empirically: an unfiltered per-record count read
    // 8-12 per call, matching the property count, not the call count). So
    // this counts CALLBACK invocations (one per delivered microtask batch,
    // i.e. one per synchronous apply()), not individual mutation records.
    const observer = new MutationObserver((mutations) => {
      const relevant = mutations.some((m) => {
        const target = m.target as Element;
        return (
          m.type === "attributes" &&
          m.attributeName === "style" &&
          target.getAttribute?.("data-vista-sheet-part") === "shadow" &&
          target.closest('[data-vista-sheet-root="main"]')
        );
      });
      if (relevant) shadowWritesThisFrame++;
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
  const framesOver1 = (arr: number[]) => arr.filter((n) => n > 1).length;

  // The reported defect was a STEADY doubling across the whole morph (every
  // frame of the ~600-900ms open/close, apply() running twice because the
  // MutationObserver stayed connected for the component's whole lifetime).
  // That is what these gates catch: the vast majority of frames must read
  // 0 or 1. Motion's OWN settle correction can still legitimately write the
  // surface's border-radius more than once within a handful of adjacent
  // frames as it converges (confirmed by stack trace: distinct
  // `ProjectionNode` writes a few ms apart, not a Shadow.tsx scheduling
  // bug) — FRAMES_OVER_1_BUDGET and PEAK_BUDGET give that real, narrow
  // tail room without re-permitting the reported whole-morph doubling.
  const FRAMES_OVER_1_BUDGET = 6;
  const PEAK_BUDGET = 6;

  expect(
    framesOver1(counters.rect),
    `frames with >1 surface getBoundingClientRect() call from Shadow: ${JSON.stringify(counters.rect)}`,
  ).toBeLessThanOrEqual(FRAMES_OVER_1_BUDGET);
  expect(
    maxRect,
    `worst per-frame surface getBoundingClientRect() calls from Shadow: ${JSON.stringify(counters.rect)}`,
  ).toBeLessThanOrEqual(PEAK_BUDGET);
  expect(
    framesOver1(counters.style),
    `frames with >1 surface getComputedStyle() call from Shadow: ${JSON.stringify(counters.style)}`,
  ).toBeLessThanOrEqual(FRAMES_OVER_1_BUDGET);
  expect(
    maxStyle,
    `worst per-frame surface getComputedStyle() calls from Shadow: ${JSON.stringify(counters.style)}`,
  ).toBeLessThanOrEqual(PEAK_BUDGET);
  expect(
    framesOver1(counters.writes),
    `frames with >1 shadow style write: ${JSON.stringify(counters.writes)}`,
  ).toBeLessThanOrEqual(FRAMES_OVER_1_BUDGET);
  expect(
    maxWrites,
    `worst per-frame shadow style writes: ${JSON.stringify(counters.writes)}`,
  ).toBeLessThanOrEqual(PEAK_BUDGET);
});
