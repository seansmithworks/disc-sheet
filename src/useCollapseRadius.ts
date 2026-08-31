"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { RADIUS_HOLD_FRACTION } from "./motion";
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
  discSize,
  varsElRef,
}: {
  collapseProgress: MotionValue<number>;
  open: boolean;
  discSize: number;
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

  // A pure function of collapseProgress — no wall-clock gate. There used to
  // be a second, TIME-based hold on top of the progress hold below
  // (RADIUS_CLOSE_DELAY_SEC: freeze at sheetRadius for 1.5s from the moment
  // `open` flips false). Two things were wrong with it, both measured on
  // every close path of both example pages:
  //
  //   * 1.5s is longer than a close takes (~1.15s including
  //     SURFACE_CLOSE_LEAD_DELAY_MS), so the gate never opened while a close
  //     was running and the progress hold below never executed at all on the
  //     close direction. The disc surface painted the SHEET's corner radius
  //     for the entire collapse, down to and including the final
  //     disc-sized frame.
  //   * That made the value bound to Disc.tsx's `.discSurface` equal
  //     sheetRadius at the instant Motion's layout animation finished and
  //     wrote its final keyframe — an inline `border-radius: 32px` (36px on
  //     the flagship) on a 128px box, i.e. a squircle, which then outlived
  //     the morph (see Disc.tsx) and was still there at rest.
  //
  // The progress hold is the mechanism that was always doing the real work:
  // it is tied to how far the BOX has actually contracted, so it cannot round
  // early regardless of how long a consumer's close spring runs.
  return useTransform(collapseProgress, (p: number) => {
    const { sheetRadius, discRadius } = radiusVarsRef.current;
    if (p <= RADIUS_HOLD_FRACTION) return sheetRadius;
    // --disc-sheet-disc-radius is a "fully round" sentinel by default
    // (9999px). Interpolating toward the raw token would clear min(w,h)/2
    // within one frame of leaving the hold and paint the M1 ellipse on a
    // still-sheet-sized box (a 212x178 box at p=0.76 would take a ~800px
    // radius). Half the disc's own box is the largest radius that means
    // anything on the shape this morph ends at, and for the default token it
    // lands on a perfect circle exactly at p=1 — so the curve is continuous
    // into the resting shape instead of popping at exit-complete.
    const discTarget = Math.min(discRadius, discSize / 2);
    const t = Math.min(
      1,
      (p - RADIUS_HOLD_FRACTION) / (1 - RADIUS_HOLD_FRACTION),
    );
    return sheetRadius + (discTarget - sheetRadius) * t;
  });
}
