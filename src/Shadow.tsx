"use client";

import { cloneElement, isValidElement, useEffect, useRef } from "react";
import type { CSSProperties, ReactElement } from "react";
import { useDiscSheetInternal } from "./context";
import type { ShadowProps } from "./types";
import styles from "./styles.module.css";

/**
 * <DiscSheet.Shadow> — the shadow seam (docs/PACKAGE-DESIGN.md §4).
 *
 * Default: renders one fixed, aria-hidden, pointer-events:none div at
 * z-1, sized/positioned to the interpolated silhouette between the disc
 * circle and the sheet box, painting a plain box-shadow from
 * --disc-sheet-shadow. Zero dependencies beyond React.
 *
 * asChild: clones the single child and merges the fixed positioning,
 * z-index, aria-hidden, pointer-events, data-* attributes, and all
 * --disc-sheet-shadow-* custom properties onto it — the shape a consumer
 * swaps in a `@seansmith/surface-fx` dither layer through. This package
 * never imports surface-fx (docs/PACKAGE-DESIGN.md §4).
 */
export function Shadow({ className, asChild, children }: ShadowProps) {
  const ctx = useDiscSheetInternal("Shadow");
  const { collapseProgress, discRect, sheetRect, zIndex, isDragging } = ctx;
  const elRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const apply = () => {
      const el = elRef.current;
      if (!el) return;
      const p = collapseProgress.get();
      const disc = discRect ?? {
        cx: sheetRect?.cx ?? 0,
        cy: sheetRect?.cy ?? 0,
        radius: sheetRect
          ? Math.min(sheetRect.halfWidth, sheetRect.halfHeight)
          : 0,
      };
      const sheet = sheetRect ?? {
        cx: disc.cx,
        cy: disc.cy,
        halfWidth: disc.radius,
        halfHeight: disc.radius,
      };

      const cx = sheet.cx + (disc.cx - sheet.cx) * p;
      const cy = sheet.cy + (disc.cy - sheet.cy) * p;
      const halfW = sheet.halfWidth + (disc.radius - sheet.halfWidth) * p;
      const halfH = sheet.halfHeight + (disc.radius - sheet.halfHeight) * p;
      const radius = sheet.halfWidth + (disc.radius - sheet.halfWidth) * p;

      el.style.setProperty("--disc-sheet-collapse", String(p));
      el.style.setProperty("--disc-sheet-shadow-x", `${cx}px`);
      el.style.setProperty("--disc-sheet-shadow-y", `${cy}px`);
      el.style.setProperty("--disc-sheet-shadow-w", `${halfW}px`);
      el.style.setProperty("--disc-sheet-shadow-h", `${halfH}px`);
      el.style.setProperty("--disc-sheet-shadow-radius", `${radius}px`);
      el.style.width = `${halfW * 2}px`;
      el.style.height = `${halfH * 2}px`;
      el.style.left = `${cx - halfW}px`;
      el.style.top = `${cy - halfH}px`;
    };

    apply();
    const unsubscribe = collapseProgress.on("change", apply);
    return unsubscribe;
  }, [collapseProgress, discRect, sheetRect]);

  const dataState = isDragging ? "dragging" : ctx.open ? "open" : "closed";

  const sharedProps = {
    "aria-hidden": true as const,
    "data-disc-sheet-part": "shadow",
    "data-state": dataState,
  };

  if (asChild && isValidElement(children)) {
    const childEl = children as ReactElement<Record<string, unknown>>;
    const childStyle = (childEl.props.style as CSSProperties | undefined) ?? {};
    return cloneElement(childEl, {
      ...sharedProps,
      ref: (node: HTMLElement | null) => {
        elRef.current = node;
      },
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
