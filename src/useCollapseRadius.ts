"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { readVarPx } from "./readVarPx";
import {
  collapseRadiusAt,
  resolveTriggerCornerRadius,
  supportsCornerShape,
} from "./shape";
import type { TriggerShape } from "./shape";

/**
 * useCollapseRadius — the hold-then-round border-radius curve (docs/
 * PACKAGE-DESIGN.md audit M1) as a numeric-px MotionValue, extracted from
 * Sheet.tsx so it can be reused.
 *
 * Called from Sheet.tsx, at the same position in Sheet's own hook order it
 * always occupied — Sheet.tsx relays this hook's output into a separate
 * stable MotionValue Root owns (`ctx.collapseRadius`), which Trigger.tsx
 * binds to (see Sheet.tsx and context.ts). Trigger.tsx's own comment
 * documents a known, measured, unavoidable cost of that binding against
 * geometry.spec.ts's close-tracking gate — read it before touching how
 * Trigger.tsx consumes this value.
 *
 * Reads the shape tokens (--vista-sheet-sheet-radius / --vista-sheet-
 * trigger-radius) off `varsElRef` — the caller decides which element to
 * read them from; Sheet.tsx passes its own `sheetRef`.
 */
export function useCollapseRadius({
  collapseProgress,
  open,
  shape,
  triggerSize,
  varsElRef,
}: {
  collapseProgress: MotionValue<number>;
  open: boolean;
  shape: TriggerShape;
  triggerSize: number;
  varsElRef: MutableRefObject<HTMLElement | null>;
}): MotionValue<number> {
  // Read via a ref (not React state) so the useTransform closure below always
  // reads the latest values without needing a "tick" motion value to force
  // recomputation — Motion's array-form useTransform only recomputes when one
  // of the listed MotionValues changes, not on ordinary re-render.
  const radiusVarsRef = useRef({ sheetRadius: 48, triggerRadius: 9999 });

  // Read the shape tokens once per open — a designer's CSS override on
  // --vista-sheet-sheet-radius / --vista-sheet-trigger-radius is honored
  // without becoming a JS prop (docs/PACKAGE-DESIGN.md §3).
  useEffect(() => {
    if (!open) return;
    radiusVarsRef.current = {
      sheetRadius: readVarPx(
        varsElRef.current,
        "--vista-sheet-sheet-radius",
        48,
      ),
      triggerRadius: readVarPx(
        varsElRef.current,
        "--vista-sheet-trigger-radius",
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
  //     close direction. The trigger surface painted the SHEET's corner
  //     radius for the entire collapse, down to and including the final
  //     trigger-sized frame.
  //   * That made the value bound to Trigger.tsx's `.triggerSurface` equal
  //     sheetRadius at the instant Motion's layout animation finished and
  //     wrote its final keyframe — an inline `border-radius: 32px` (36px on
  //     the flagship) on a 128px box, i.e. a squircle, which then outlived
  //     the morph (see Trigger.tsx) and was still there at rest. The
  //     progress hold is the mechanism doing the real work — it's tied to
  //     how far the BOX has contracted, not how long a close spring runs.
  //
  // The curve itself (collapseRadiusAt, src/shape.ts) is shared verbatim with
  // Shadow.tsx (task 3, DESIGN.md §4.1 "one surface, one clock") — the two
  // used to disagree (Shadow ran its own linear interpolation), which
  // (rt) now catches. `shape` is read live from the closure: Motion's
  // useCombineMotionValues re-runs this transformer's latest closure on every
  // render (verified in framer-motion's use-combine-values.mjs), the same way
  // `triggerSize` already was before this change.
  return useTransform(collapseProgress, (p: number) => {
    const { sheetRadius, triggerRadius } = radiusVarsRef.current;
    return collapseRadiusAt(
      p,
      sheetRadius,
      resolveTriggerCornerRadius({
        shape,
        triggerSize,
        token: triggerRadius,
        cornerShapeSupported: supportsCornerShape(),
      }),
    );
  });
}
