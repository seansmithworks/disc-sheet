"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import { sheetPlacement } from "./anchors";
import { SlotContext, useDiscSheetInternal } from "./context";
import {
  RADIUS_CLOSE_DELAY_SEC,
  RADIUS_HOLD_FRACTION,
  SWIPE_OFFSET_PX,
  SWIPE_VELOCITY_PX_S,
} from "./motion";
import { readVarPx } from "./readVarPx";
import { useDialogBehavior } from "./useDialogBehavior";
import type { SheetProps } from "./types";
import styles from "./styles.module.css";

/**
 * <DiscSheet.Sheet> — the modal surface. Shares the disc's layoutId so
 * Motion FLIPs the box between the two, and drives border-radius as a pure
 * function of collapseProgress (docs/PACKAGE-DESIGN.md §3) rather than an
 * independent spring, so the disc shape can never appear before the box has
 * actually contracted.
 */
export function Sheet({
  children,
  className,
  dismissOnSwipe = true,
  dismissOnBackdrop = true,
  ...labelled
}: SheetProps) {
  const ctx = useDiscSheetInternal("Sheet");
  const {
    open,
    setOpen,
    anchor,
    discSize,
    sheetMaxWidth,
    reduceMotion,
    zIndex,
    idBase,
    sheetId,
    collapseProgress,
    setSheetRect,
    transition,
    triggerElRef,
    contentScrollElRef,
    hasRegisteredClose,
  } = ctx;

  const sheetRef = useRef<HTMLDivElement | null>(null);
  // Read via a ref (not React state) so the useTransform closure below always
  // reads the latest values without needing a "tick" motion value to force
  // recomputation — Motion's array-form useTransform only recomputes when one
  // of the listed MotionValues changes, not on ordinary re-render.
  const radiusVarsRef = useRef({ sheetRadius: 32, discRadius: 9999 });

  useDialogBehavior({
    isOpen: open,
    panelRef: sheetRef,
    onClose: () => setOpen(false),
  });

  // Read the shape tokens once per open — a designer's CSS override on
  // --disc-sheet-sheet-radius / --disc-sheet-disc-radius is honored without
  // becoming a JS prop (docs/PACKAGE-DESIGN.md §3).
  useEffect(() => {
    if (!open) return;
    radiusVarsRef.current = {
      sheetRadius: readVarPx(sheetRef.current, "--disc-sheet-sheet-radius", 32),
      discRadius: readVarPx(sheetRef.current, "--disc-sheet-disc-radius", 9999),
    };
  }, [open]);

  useEffect(() => {
    if (
      open &&
      process.env.NODE_ENV !== "production" &&
      !hasRegisteredClose()
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        "[disc-sheet] <DiscSheet.Sheet> opened with no <DiscSheet.Close> registered. " +
          "Escape and backdrop dismissal are not a substitute for a visible close control.",
      );
    }
  }, [open, hasRegisteredClose]);

  // Measure the sheet's settled CSS geometry (offsetLeft/Top, not
  // getBoundingClientRect — the latter includes the in-flight FLIP transform
  // and would produce a jumping rect).
  useLayoutEffect(() => {
    if (!open) return;
    function measure() {
      const el = sheetRef.current;
      if (!el) return;
      setSheetRect({
        cx: el.offsetLeft + el.offsetWidth / 2,
        cy: el.offsetTop + el.offsetHeight / 2,
        halfWidth: el.offsetWidth / 2,
        halfHeight: el.offsetHeight / 2,
      });
    }
    measure();
    window.addEventListener("resize", measure);
    // Deliberately does NOT clear sheetRect here. This cleanup runs the
    // instant `open` flips false — i.e. exactly when the close animation
    // STARTS, not when it finishes. Shadow.tsx reads sheetRect for the
    // entire close morph; nulling it here collapsed the silhouette to the
    // disc's box for the whole close animation. sheetRect is cleared once,
    // in AnimatePresence's onExitComplete below, after the exit animation
    // has actually finished.
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, [open, setSheetRect]);

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

  const borderRadius = useTransform(
    [collapseProgress, radiusGate],
    ([p, gate]: number[]) => {
      const { sheetRadius, discRadius } = radiusVarsRef.current;
      if (gate < 1) return sheetRadius;
      if (p <= RADIUS_HOLD_FRACTION) return sheetRadius;
      const t = (p - RADIUS_HOLD_FRACTION) / (1 - RADIUS_HOLD_FRACTION);
      return sheetRadius + (discRadius - sheetRadius) * t;
    },
  );

  const placement =
    typeof window !== "undefined"
      ? sheetPlacement(
          anchor,
          window.innerWidth,
          window.innerHeight,
          discSize,
          sheetMaxWidth,
        )
      : sheetPlacement(anchor, 1440, 900, discSize, sheetMaxWidth);

  const placementStyle: Record<string, string> = {
    ["--disc-sheet-sheet-left" as string]: `${placement.anchorX}px`,
  };
  if (placement.anchorEdge === "top" && placement.anchorTopPx !== undefined) {
    // Override the CSS default (grow up from bottom) with explicit top/bottom
    // — direct properties, not a var, so they always win over .sheet's
    // `bottom: 16px` default regardless of cascade order.
    placementStyle.top = `${placement.anchorTopPx}px`;
    placementStyle.bottom = "auto";
    placementStyle.maxHeight = `calc(100dvh - ${placement.anchorTopPx}px - 16px)`;
  }

  function handleDragEnd(
    _e: unknown,
    info: { offset: { y: number }; velocity: { y: number } },
  ) {
    if (!dismissOnSwipe) return;
    const scrollTop = contentScrollElRef.current?.scrollTop ?? 0;
    if (scrollTop > 0) return;
    if (
      info.offset.y > SWIPE_OFFSET_PX ||
      info.velocity.y > SWIPE_VELOCITY_PX_S
    ) {
      setOpen(false);
    }
  }

  return (
    <AnimatePresence
      onExitComplete={() => {
        triggerElRef.current?.focus();
        // Exit-complete is when the close morph is actually done — the
        // correct moment to drop sheetRect (see the measure effect above).
        setSheetRect(null);
      }}
    >
      {open && (
        <>
          {/* Invisible click-catcher for outside-click dismissal — not a
              visible scrim. <DiscSheet.Backdrop> (a visual dim layer) is cut
              from v0.1 (docs/PACKAGE-DESIGN.md §8); dismiss-on-outside-click
              is Root/Sheet behavior and costs nothing visually by default. */}
          {dismissOnBackdrop && (
            <div
              aria-hidden="true"
              data-disc-sheet-part="backdrop"
              style={{ position: "fixed", inset: 0, zIndex: zIndex + 101 }}
              onClick={() => setOpen(false)}
            />
          )}
          <motion.div
            ref={sheetRef}
            id={sheetId}
            className={`${styles.sheet} ${className ?? ""}`}
            data-disc-sheet-part="sheet"
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            {...labelled}
            {...(reduceMotion
              ? {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  exit: { opacity: 0 },
                  transition: { duration: 0.2 },
                  style: { zIndex: zIndex + 102, ...placementStyle },
                }
              : {
                  layoutId: `${idBase}-surface`,
                  // The SHEET is the entering element on open (Disc's surface
                  // is the entering element on close, gated behind
                  // `{!open && ...}`), and with a shared layoutId the
                  // ENTERING side's transition governs the FLIP. This must be
                  // transition.open, not transition.close — passing .close
                  // here made the open morph run the close spring (plus its
                  // baked-in SURFACE_CLOSE_LEAD_DELAY_MS) while
                  // collapseProgress ran the open spring with no delay,
                  // which is why the shadow silhouette and this box visibly
                  // separated on open.
                  transition: transition.open,
                  style: {
                    borderRadius,
                    zIndex: zIndex + 102,
                    ...placementStyle,
                  },
                })}
            drag={reduceMotion || !dismissOnSwipe ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragEnd={handleDragEnd}
          >
            <SlotContext.Provider value="sheet">
              {children}
            </SlotContext.Provider>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
