"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { useMotionValue, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { RADIUS_CLOSE_DELAY_SEC, RADIUS_HOLD_FRACTION } from "./motion";
import { readVarPx } from "./readVarPx";

/**
 * useCollapseRadius — the hold-then-round border-radius curve (docs/
 * PACKAGE-DESIGN.md audit M1) as a numeric-px MotionValue, extracted from
 * Sheet.tsx so it can be reused.
 *
 * Called from Sheet.tsx, at the same position in Sheet's own hook order it
 * always occupied — Sheet.tsx relays this hook's output into a separate
 * stable MotionValue Root owns (`ctx.collapseRadius`), which Disc.tsx binds
 * to (see Sheet.tsx and context.ts). Disc.tsx's own comment documents a
 * known, measured, unavoidable cost of that binding against
 * geometry.spec.ts's close-tracking gate — read it before touching how
 * Disc.tsx consumes this value.
 *
 * Reads the shape tokens (--disc-sheet-sheet-radius / --disc-sheet-disc-
 * radius) off `varsElRef` — the caller decides which element to read them
 * from; Sheet.tsx passes its own `sheetRef`.
 */
export function useCollapseRadius({
  collapseProgress,
  open,
  reduceMotion,
  varsElRef,
}: {
  collapseProgress: MotionValue<number>;
  open: boolean;
  reduceMotion: boolean;
  varsElRef: MutableRefObject<HTMLElement | null>;
}): MotionValue<number> {
  // Read via a ref (not React state) so the useTransform closure below always
  // reads the latest values without needing a "tick" motion value to force
  // recomputation — Motion's array-form useTransform only recomputes when one
  // of the listed MotionValues changes, not on ordinary re-render.
  const radiusVarsRef = useRef({ sheetRadius: 32, discRadius: 9999 });

  // Read the shape tokens once per open — a designer's CSS override on
  // --disc-sheet-sheet-radius / --disc-sheet-disc-radius is honored without
  // becoming a JS prop (docs/PACKAGE-DESIGN.md §3).
  useEffect(() => {
    if (!open) return;
    radiusVarsRef.current = {
      sheetRadius: readVarPx(
        varsElRef.current,
        "--disc-sheet-sheet-radius",
        32,
      ),
      discRadius: readVarPx(
        varsElRef.current,
        "--disc-sheet-disc-radius",
        9999,
      ),
    };
  }, [open, varsElRef]);

  // Time-gate: on close, hold the sheet radius for RADIUS_CLOSE_DELAY_SEC
  // before the progress-based hold/interpolation below is allowed to round it
  // — prevents the oval reading too early in a long close.
  const radiusGate = useMotionValue(1);
  useEffect(() => {
    if (open || reduceMotion) {
      radiusGate.set(1);
      return;
    }
    radiusGate.set(0);
    const id = window.setTimeout(() => {
      radiusGate.set(1);
    }, RADIUS_CLOSE_DELAY_SEC * 1000);
    return () => window.clearTimeout(id);
  }, [open, reduceMotion, radiusGate]);

  return useTransform([collapseProgress, radiusGate], ([p, gate]: number[]) => {
    const { sheetRadius, discRadius } = radiusVarsRef.current;
    if (gate < 1) return sheetRadius;
    if (p <= RADIUS_HOLD_FRACTION) return sheetRadius;
    const t = (p - RADIUS_HOLD_FRACTION) / (1 - RADIUS_HOLD_FRACTION);
    return sheetRadius + (discRadius - sheetRadius) * t;
  });
}
