"use client";

import { cloneElement, isValidElement, useEffect, useRef } from "react";
import type { CSSProperties, ReactElement, Ref } from "react";
import { useVistaSheetInternal } from "./context";
import { readVarPx } from "./readVarPx";
import type { ShadowProps } from "./types";
import styles from "./styles.module.css";

/**
 * <VistaSheet.Shadow> — the shadow seam (docs/PACKAGE-DESIGN.md §4).
 *
 * Default: renders one fixed, aria-hidden, pointer-events:none div at
 * z-1, sized/positioned to the interpolated silhouette between the trigger
 * circle and the sheet box. It paints BOTH looks on that one silhouette —
 * the thin disc shadow (--vista-sheet-shadow) and the sheet's heavier
 * resting shadow (--vista-sheet-sheet-shadow), as two layers (.shadow::before
 * / ::after in styles.module.css) crossfaded by opacity as a function of
 * collapseProgress. This is the only place either shadow is painted (DESIGN.md
 * §4.1 "one surface, one clock") — the sheet used to paint its own resting
 * shadow via `.sheet[data-vista-sheet-settled]`, which was a second clock and
 * produced a one-frame pop when a demo mask clipped it at the phase boundary.
 * Zero dependencies beyond React.
 *
 * The crossfade window (where in collapseProgress the handoff happens) is a
 * taste value, exposed as two consumer-overridable CSS custom properties —
 * --vista-sheet-sheet-shadow-fade-start / -fade-end — read the same way
 * --vista-sheet-sheet-radius already is, via readVarPx.
 *
 * asChild: clones the single child and merges the fixed positioning,
 * z-index, aria-hidden, pointer-events, data-* attributes, and all
 * --vista-sheet-shadow-* custom properties (including the two crossfade
 * opacities) onto it — the shape a consumer swaps in a
 * `@seansmithworks/surface-fx` dither layer through. This package never
 * imports surface-fx (docs/PACKAGE-DESIGN.md §4).
 *
 * A ref already on the child (object or callback — read from `child.props.ref`,
 * the React 19 shape; the peer range is `react >=19`, so the React 18 side
 * channel on the element itself is never consulted) is composed with Shadow's
 * own internal ref rather than overwritten, via mergeShadowRef below.
 */

/**
 * Composes a consumer-supplied ref (object or callback, or none) with
 * Shadow's own internal ref callback so an asChild clone forwards the DOM
 * node to both instead of only the last one assigned.
 */
export function mergeShadowRef<T>(
  childRef: Ref<T> | null | undefined,
  internalRef: (node: T | null) => void,
): (node: T | null) => void {
  return (node) => {
    internalRef(node);
    if (typeof childRef === "function") {
      childRef(node);
    } else if (childRef) {
      (childRef as { current: T | null }).current = node;
    }
  };
}
export function Shadow({ className, asChild, children }: ShadowProps) {
  const ctx = useVistaSheetInternal("Shadow");
  const {
    collapseProgress,
    triggerRect,
    sheetRect,
    sheetDragY,
    zIndex,
    isDragging,
    shape,
  } = ctx;
  const elRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const apply = () => {
      const el = elRef.current;
      if (!el) return;
      const p = collapseProgress.get();
      const trigger = triggerRect ?? {
        cx: sheetRect?.cx ?? 0,
        cy: sheetRect?.cy ?? 0,
        radius: sheetRect
          ? Math.min(sheetRect.halfWidth, sheetRect.halfHeight)
          : 0,
      };
      // sheetRect is measured from offsetLeft/Top (Sheet.tsx), which by
      // definition excludes transforms — so a live drag on the sheet never
      // shows up there. sheetDragY is the sheet's own drag `y` MotionValue
      // (bound directly, not re-measured per frame — see the D1 fix note
      // in context.ts), folded in here as a translation on top of the
      // measured rect.
      const dragY = sheetDragY.get();
      const sheet = sheetRect
        ? { ...sheetRect, cy: sheetRect.cy + dragY }
        : {
            cx: trigger.cx,
            cy: trigger.cy,
            halfWidth: trigger.radius,
            halfHeight: trigger.radius,
          };

      const cx = sheet.cx + (trigger.cx - sheet.cx) * p;
      const cy = sheet.cy + (trigger.cy - sheet.cy) * p;
      const halfW = sheet.halfWidth + (trigger.radius - sheet.halfWidth) * p;
      const halfH = sheet.halfHeight + (trigger.radius - sheet.halfHeight) * p;
      // The silhouette's corner radius interpolates between the SHEET's own
      // corner radius (not its half-width, which produced a stadium instead
      // of the sheet's actual rounded-rect silhouette) and the trigger's radius.
      const sheetRadius = readVarPx(el, "--vista-sheet-sheet-radius", 32);
      const radius = sheetRadius + (trigger.radius - sheetRadius) * p;

      // Crossfade window: the heavy sheet shadow is fully in at p=0 (open,
      // at rest) and fades out to the thin disc shadow by p=fadeEnd — a
      // taste value, dialled via these two CSS vars rather than hand-typed
      // (DESIGN.md §4.4, "springs and taste values are dialled, never
      // typed" — this isn't a spring, but the same rule applies to any
      // number a stranger would otherwise have to guess). collapseProgress
      // overshoots slightly past its [0,1] range on spring rebound (measured
      // ~-0.0094) — clamp before using it for opacity, since opacity is the
      // only property this crossfade may animate (§4.3: transform/opacity
      // only while the clock runs).
      const pClamped = p < 0 ? 0 : p > 1 ? 1 : p;
      const fadeStart = readVarPx(
        el,
        "--vista-sheet-sheet-shadow-fade-start",
        0,
      );
      const fadeEnd = readVarPx(
        el,
        "--vista-sheet-sheet-shadow-fade-end",
        0.25,
      );
      const span = fadeEnd - fadeStart;
      const sheetShadowOpacity =
        span <= 0
          ? pClamped <= fadeStart
            ? 1
            : 0
          : Math.min(1, Math.max(0, (fadeEnd - pClamped) / span));
      const discShadowOpacity = 1 - sheetShadowOpacity;

      el.style.setProperty("--vista-sheet-collapse", String(p));
      el.style.setProperty(
        "--vista-sheet-shadow-opacity",
        String(discShadowOpacity),
      );
      el.style.setProperty(
        "--vista-sheet-sheet-shadow-opacity",
        String(sheetShadowOpacity),
      );
      el.style.setProperty("--vista-sheet-shadow-x", `${cx}px`);
      el.style.setProperty("--vista-sheet-shadow-y", `${cy}px`);
      el.style.setProperty("--vista-sheet-shadow-w", `${halfW}px`);
      el.style.setProperty("--vista-sheet-shadow-h", `${halfH}px`);
      el.style.setProperty("--vista-sheet-shadow-radius", `${radius}px`);
      el.style.width = `${halfW * 2}px`;
      el.style.height = `${halfH * 2}px`;
      el.style.left = `${cx - halfW}px`;
      el.style.top = `${cy - halfH}px`;
    };

    apply();
    const unsubscribeProgress = collapseProgress.on("change", apply);
    // Drag frames must re-run apply() too, or the shadow only picks up the
    // drag offset on the NEXT collapseProgress tick (i.e. never, while the
    // sheet sits fully open at p=0 with no progress change in flight) — this
    // is the D1 fix.
    const unsubscribeDrag = sheetDragY.on("change", apply);
    return () => {
      unsubscribeProgress();
      unsubscribeDrag();
    };
  }, [collapseProgress, triggerRect, sheetRect, sheetDragY]);

  const dataState = isDragging ? "dragging" : ctx.open ? "open" : "closed";

  const sharedProps = {
    "aria-hidden": true as const,
    "data-vista-sheet-part": "shadow",
    "data-state": dataState,
    "data-vista-sheet-shape": shape,
  };

  if (asChild && isValidElement(children)) {
    const childEl = children as ReactElement<Record<string, unknown>>;
    const childStyle = (childEl.props.style as CSSProperties | undefined) ?? {};
    const childRef = (childEl.props as { ref?: Ref<HTMLElement> }).ref;
    return cloneElement(childEl, {
      ...sharedProps,
      ref: mergeShadowRef(childRef, (node) => {
        elRef.current = node;
      }),
      style: {
        position: "fixed",
        zIndex: zIndex - 1,
        pointerEvents: "none",
        ...childStyle,
      },
    });
  }

  return (
    <div
      ref={(node) => {
        elRef.current = node;
      }}
      className={`${styles.shadow} ${className ?? ""}`}
      style={{ position: "fixed", zIndex: zIndex - 1, pointerEvents: "none" }}
      {...sharedProps}
    />
  );
}
