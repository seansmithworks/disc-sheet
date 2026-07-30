"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  LayoutGroup,
  animate,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { DEFAULT_ANCHOR, type AnchorId } from "./anchors";
import { DiscSheetContext, type DiscSheetContextValue } from "./context";
import {
  DEFAULT_CLOSE_SPRING,
  DEFAULT_OPEN_SPRING,
  DEFAULT_SHARED_SPRING,
  mergeTransition,
  SURFACE_CLOSE_LEAD_DELAY_MS,
} from "./motion";
import type { Rect, RootProps, SheetRect } from "./types";
import {
  MD_BREAKPOINT,
  resolveDiscSize,
  useDiscSize,
  XL_BREAKPOINT,
} from "./useDiscSize";
import { usePersistedAnchor } from "./usePersistedAnchor";

/**
 * <DiscSheet.Root> — owns open state, anchor state, the LayoutGroup, the
 * shared context, and the reduced-motion decision.
 *
 * Anchor is uncontrolled-only in v0.1 (docs/PACKAGE-DESIGN.md §8): the
 * consumer gets onAnchorChange as a read-only notification, never a
 * controlled pair.
 */
export function Root({
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  defaultAnchor = DEFAULT_ANCHOR,
  onAnchorChange,
  draggable = true,
  persistKey,
  discSize: discSizeProp,
  sheetMaxWidth = 480,
  transition,
  reduceMotion: reduceMotionProp,
  id,
  zIndex = 100,
  className,
}: RootProps) {
  const generatedId = useId();
  const idBase = id ?? generatedId;

  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const [anchor, setAnchorState] = usePersistedAnchor(
    defaultAnchor,
    persistKey,
  );
  const setAnchor = useCallback(
    (next: AnchorId) => {
      setAnchorState(next);
      onAnchorChange?.(next);
    },
    [setAnchorState, onAnchorChange],
  );

  const discSize = useDiscSize(discSizeProp);

  // D3 fix — cold-first-open stale shared-layoutId FLIP origin
  // (docs/PACKAGE-DESIGN.md, reference_pinned-bottoms-collapse-dtop-and-
  // dheight-into-one-assertion). `discSize` above still resolves at vpW=0 on
  // first render for hydration safety, then promotes in a post-mount effect
  // — Motion snapshots a shared-layoutId element's box at first paint, which
  // lands INSIDE that pre-promotion window, so the disc-side box gets
  // FLIP-tracked at the ramp's base size even on a real (non-base) viewport.
  // Root re-mounting or re-snapshotting later can't fix this: the snapshot
  // that matters is the FIRST one, and it is already stale by the time any
  // JS effect could run.
  //
  // CSS can resolve a viewport-dependent value at first paint with no JS and
  // no hydration risk — a real @media query, evaluated by the browser before
  // any script runs. discSizeCss below derives the same three breakpoint
  // values from resolveDiscSize (the ramp's one source of truth, shared with
  // the live `discSize` above) and Root renders them as a scoped <style>
  // block. Every element that reads --disc-sheet-disc-size (Disc.tsx's drag
  // wrapper, .shared in styles.module.css) now gets the CORRECT size on the
  // very first frame, so there is never a stale snapshot for Motion to
  // chase. `discSize` (JS) still exists and still promotes post-mount, but
  // now only for position math (anchors.ts) and drag-constraint numbers —
  // never for a FLIP-tracked element's box.
  const discSizeCss = {
    base: resolveDiscSize(discSizeProp, 0),
    md: resolveDiscSize(discSizeProp, MD_BREAKPOINT),
    xl: resolveDiscSize(discSizeProp, XL_BREAKPOINT),
  };

  const [isDragging, setIsDragging] = useState(false);

  const systemReduceMotion = useReducedMotion();
  const reduceMotion = reduceMotionProp ?? Boolean(systemReduceMotion);

  // ── The morph clock ────────────────────────────────────────────────────
  // collapseProgress: 0 = fully open (sheet), 1 = fully closed (disc). Owned
  // here so Disc, Sheet, Shared and Shadow all read the same live value —
  // this is the MotionValue usePKG() exposes as the escape hatch (§3).
  const collapseProgress = useMotionValue(1);
  const prevOpenRef = useRef<boolean | null>(null);

  // Sheet's drag="y" gesture writes into this directly (bound as its motion
  // `y` style) so Shadow can read the live drag offset without re-measuring
  // sheetRect every drag frame (docs: the D1 fix — sheetRect is measured
  // from offsetLeft/Top, which excludes transforms by definition, so it can
  // never see a drag on its own).
  const sheetDragY = useMotionValue(0);

  const openTransition = mergeTransition(transition?.open, DEFAULT_OPEN_SPRING);
  const closeTransition = mergeTransition(
    transition?.close,
    DEFAULT_CLOSE_SPRING,
    reduceMotion ? undefined : SURFACE_CLOSE_LEAD_DELAY_MS / 1000,
  );
  const sharedTransition = mergeTransition(
    transition?.shared,
    DEFAULT_SHARED_SPRING,
  );

  // Drive collapseProgress on genuine open/close transitions only — a
  // reference change on `transition` while the sheet is already open must
  // never re-trigger the bloom. Runs as an effect (not during render):
  // animate() is a side effect and must not fire synchronously in the
  // render pass.
  useEffect(() => {
    const wasOpen = prevOpenRef.current === true;
    prevOpenRef.current = open;
    const isOpening = open && !wasOpen;
    const isClosing = !open && wasOpen;
    if (!isOpening && !isClosing) return;

    if (reduceMotion) {
      collapseProgress.jump(open ? 0 : 1);
      return;
    }

    if (isOpening) {
      collapseProgress.set(1);
      // Cast: animate()'s MotionValue<number> overload wants motion-dom's
      // ValueAnimationTransition, which framer-motion doesn't re-export —
      // openTransition is the same public `Transition` shape used on
      // <motion.div transition>, just not nominally that type.
      //
      // This must be the SAME openTransition object Sheet.tsx's layoutId
      // transition uses (context.transition.open below), not a copy with
      // delay forced to 0 — a consumer's transition.open.delay has to shift
      // both the surface FLIP and this collapseProgress clock together, or
      // the shadow desyncs from the surface for exactly the delay window
      // (the same class of bug 686bf58 fixed for the untouched-delay case).
      animate(collapseProgress, 0, {
        ...openTransition,
        velocity: 0,
      } as never);
    } else {
      // velocity: 0 (not the inherited in-flight velocity Motion's
      // animate() uses by default — motion-dom's animateMotionValue reads
      // value.getVelocity() unless overridden). On a reversal (Escape fired
      // mid-open), Motion's own layout-projection spring — the one that
      // actually moves the shared-layoutId surface — always restarts its
      // internal progress value at velocity: 0
      // (motion-dom create-projection-node.mjs startAnimation: `jump(0,
      // false)` then `animateSingleValue(..., { velocity: 0 })`,
      // unconditionally, every time). collapseProgress drives the shadow
      // layer on a separate clock; if it inherits the open animation's
      // in-flight velocity instead of also restarting at 0, the two clocks
      // diverge from different starting velocities and settle apart. Forcing
      // 0 here makes both clocks start a reversal identically.
      animate(collapseProgress, 1, {
        ...closeTransition,
        velocity: 0,
      } as never);
    }
  }, [open, collapseProgress, openTransition, closeTransition, reduceMotion]);

  const [discRect, setDiscRect] = useState<Rect | null>(null);
  const [sheetRect, setSheetRect] = useState<SheetRect | null>(null);

  const triggerElRef = useRef<HTMLButtonElement | null>(null);
  const contentScrollElRef = useRef<HTMLDivElement | null>(null);

  const closeRegisteredRef = useRef(0);
  const registerClose = useCallback(() => {
    closeRegisteredRef.current += 1;
    return () => {
      closeRegisteredRef.current = Math.max(0, closeRegisteredRef.current - 1);
    };
  }, []);
  const hasRegisteredClose = useCallback(
    () => closeRegisteredRef.current > 0,
    [],
  );

  const triggerId = `${idBase}-disc-trigger`;
  const sheetId = `${idBase}-sheet`;

  const contextValue: DiscSheetContextValue = {
    open,
    setOpen,
    anchor,
    setAnchor,
    onAnchorChange,
    isDragging,
    setIsDragging,
    draggable,
    discSize,
    sheetMaxWidth,
    reduceMotion,
    zIndex,
    idBase,
    triggerId,
    sheetId,
    collapseProgress,
    discRect,
    setDiscRect,
    sheetRect,
    setSheetRect,
    sheetDragY,
    transition: {
      open: openTransition,
      close: closeTransition,
      shared: sharedTransition,
    },
    registerClose,
    hasRegisteredClose,
    triggerElRef,
    contentScrollElRef,
  };

  // Scoped by idBase (unique per <Root> instance via useId or a
  // consumer-supplied `id`) so multiple mounted Roots' rules can't collide.
  // A plain <style> child (React text content, not dangerouslySetInnerHTML)
  // — server-rendered and deterministic from props alone, so the server and
  // the client's first render emit byte-identical CSS and there is no
  // hydration mismatch risk (E5).
  const discSizeStyleRule = `[data-disc-sheet-root="${idBase}"]{--disc-sheet-disc-size:${discSizeCss.base}px}`;
  const discSizeStyleMd = `@media (min-width:${MD_BREAKPOINT}px){[data-disc-sheet-root="${idBase}"]{--disc-sheet-disc-size:${discSizeCss.md}px}}`;
  const discSizeStyleXl = `@media (min-width:${XL_BREAKPOINT}px){[data-disc-sheet-root="${idBase}"]{--disc-sheet-disc-size:${discSizeCss.xl}px}}`;

  return (
    <DiscSheetContext.Provider value={contextValue}>
      <LayoutGroup id={idBase}>
        <style>{`${discSizeStyleRule}${discSizeStyleMd}${discSizeStyleXl}`}</style>
        <div
          className={className}
          data-disc-sheet-root={idBase}
          style={{
            // Root's wrapper is an ANCESTOR of both <Disc> and <Sheet>, unlike
            // the disc root div (a sibling of <Sheet>), so custom properties
            // written here are the only ones both slots can inherit. B1:
            // --disc-sheet-disc-size was previously written only on the disc
            // root, making it invisible to .shared in the sheet above the
            // ramp's base breakpoint. M1/M2: --disc-sheet-z and
            // --disc-sheet-sheet-max-width were never written at all, leaving
            // the zIndex and sheetMaxWidth props orphaned from the CSS that
            // reads them.
            //
            // --disc-sheet-disc-size is NOT written here anymore (D3 fix,
            // above) — an inline style write on this element would always
            // beat the scoped <style> block's @media rules, for any
            // viewport, defeating the whole point of resolving it in CSS.
            ["--disc-sheet-z" as string]: String(zIndex),
            ["--disc-sheet-sheet-max-width" as string]: `${sheetMaxWidth}px`,
          }}
        >
          {children}
        </div>
      </LayoutGroup>
    </DiscSheetContext.Provider>
  );
}
