"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { sheetPlacement } from "./anchors";
import { SlotContext, useDiscSheetInternal } from "./context";
import { SWIPE_OFFSET_PX, SWIPE_VELOCITY_PX_S } from "./motion";
import { useCollapseRadius } from "./useCollapseRadius";
import { useDialogBehavior } from "./useDialogBehavior";
import type { SheetProps } from "./types";
import styles from "./styles.module.css";

// `process` is not declared in a Vite consumer's tsconfig (`types` is an
// allowlist, so @types/node never loads). Declare it locally rather than
// depending on the consumer's ambient globals.
declare const process: { env: { NODE_ENV?: string } };

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
    sheetDragY,
    transition,
    triggerElRef,
    contentScrollElRef,
    hasRegisteredClose,
    collapseRadius,
  } = ctx;

  const sheetRef = useRef<HTMLDivElement | null>(null);

  useDialogBehavior({
    isOpen: open,
    panelRef: sheetRef,
    onClose: () => setOpen(false),
  });

  // Reset the drag offset on every open — a value left over from the
  // previous open's drag (or its dismiss) must not leak into a fresh mount;
  // Shadow.tsx reads sheetDragY unconditionally, even before the user has
  // dragged at all this time.
  useEffect(() => {
    if (open) sheetDragY.jump(0);
  }, [open, sheetDragY]);

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
    const el = sheetRef.current;
    if (!el) return;
    setSheetRect({
      cx: el.offsetLeft + el.offsetWidth / 2,
      cy: el.offsetTop + el.offsetHeight / 2,
      halfWidth: el.offsetWidth / 2,
      halfHeight: el.offsetHeight / 2,
    });
  }, [open, setSheetRect]);

  // Resize listener, deliberately NOT gated on `open`: the sheet DOM node
  // stays mounted for the entire close animation (AnimatePresence only
  // removes it once the exit finishes), and its CSS geometry (`bottom: 16px`
  // etc.) keeps re-laying-out live if the viewport resizes mid-close —
  // Disc.tsx's resting position re-seats on the very same resize. Gating this
  // listener's registration on `open` (the previous shape: one effect doing
  // both the initial measure AND the listener, keyed on [open]) tore the
  // listener down the INSTANT `open` flipped false, i.e. exactly when the
  // close starts, freezing the sheet's cached rect for the whole ~1s close
  // while the disc re-seated live — reproduced a 481.7px Δtop. Same
  // principle as sheetRect's own release below: state a leaving element's
  // siblings still need is released on completion, never on the state
  // change that begins the exit.
  useEffect(() => {
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
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, [setSheetRect]);

  // Extracted (audit M1) so the exact same hold/interpolation curve is
  // available to Disc.tsx's disc-surface too — see useCollapseRadius.ts.
  // Called from HERE (not hoisted to Root) deliberately: same component,
  // same hook position, same effect-commit ordering relative to Sheet's
  // other effects (sheetRect measurement, the resize listener) as before
  // this fix existed. Moving the CALL SITE to Root while keeping the hook's
  // logic identical measurably cost geometry.spec.ts's close-tracking gate
  // ~3-4px — apparently from the ordering shift itself, not from anything
  // about the computation. The effect below relays every tick into
  // ctx.collapseRadius (a stable container Root owns) so Disc.tsx can bind
  // to the exact same painted values on close without needing this hook
  // called from its own position in the tree.
  const sheetBorderRadius = useCollapseRadius({
    collapseProgress,
    open,
    reduceMotion,
    varsElRef: sheetRef,
  });

  useEffect(() => {
    collapseRadius.set(sheetBorderRadius.get());
    return sheetBorderRadius.on("change", (v) => collapseRadius.set(v));
  }, [sheetBorderRadius, collapseRadius]);

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
      // Once AnimatePresence starts the exit, the box's PAINTED position is
      // governed by the layoutId FLIP target, not by the drag gesture's own
      // y value — but the drag's elastic release/snap-back animation on
      // sheetDragY keeps running in the background regardless, still
      // updating a value nothing renders anymore. Shadow.tsx reads that
      // value live, so it kept tracking a phantom in-flight release while
      // the actual surface sat frozen at its lead-delay hold position — a
      // flat ~30px error across the whole swipe-dismiss close. stop()
      // freezes sheetDragY at exactly the value it holds at the moment of
      // dismiss (matching where the surface is actually still painted, mid
      // elastic-drag, right up until the FLIP takes over).
      sheetDragY.stop();
      setOpen(false);
    }
  }

  return (
    <>
      {/* Invisible click-catcher for outside-click dismissal — not a
          visible scrim. <DiscSheet.Backdrop> (a visual dim layer) is cut
          from v0.1 (docs/PACKAGE-DESIGN.md §8); dismiss-on-outside-click is
          Root/Sheet behavior and costs nothing visually by default.
          Deliberately a SIBLING of <AnimatePresence>, gated on `open` alone
          (audit M11) — the previous shape rendered this inside
          AnimatePresence's `{open && ...}` child, so it survived the whole
          exit animation at zIndex + 101 (above the disc's zIndex 100),
          eating every click/tap over the disc for the ~400-1000ms the close
          spring/hold takes to settle. Gating on `open` alone means the
          backdrop unmounts the instant the close STARTS, so the disc is
          tappable — and the close interruptible — from frame one. */}
      {open && dismissOnBackdrop && (
        <div
          aria-hidden="true"
          data-disc-sheet-part="backdrop"
          style={{ position: "fixed", inset: 0, zIndex: zIndex + 101 }}
          onClick={() => setOpen(false)}
        />
      )}
      <AnimatePresence
        onExitComplete={() => {
          triggerElRef.current?.focus();
          // Exit-complete is when the close morph is actually done — the
          // correct moment to drop sheetRect (see the measure effect above).
          setSheetRect(null);
        }}
      >
        {open && (
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
                    // Bound directly to the locally-computed value (not the
                    // relayed ctx.collapseRadius container Disc.tsx reads) —
                    // zero extra hop for this element's own paint.
                    borderRadius: sheetBorderRadius,
                    zIndex: zIndex + 102,
                    // Bound as our own MotionValue (not left for Motion's
                    // drag gesture to create internally) so Shadow.tsx can
                    // subscribe to the live drag offset — see the D1 fix
                    // note on sheetDragY in context.ts.
                    y: sheetDragY,
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
        )}
      </AnimatePresence>
    </>
  );
}
