"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
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
  DEFAULT_SHARED_CLOSE_SPRING,
  DEFAULT_SHARED_SPRING,
  mergeTransition,
  SURFACE_CLOSE_LEAD_DELAY_MS,
  isSharedByDirection,
} from "./motion";
import type { Transition } from "motion/react";
import type { Rect, RootProps, SheetRect, Spring } from "./types";
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
  surfaceCloseLeadDelayMs = SURFACE_CLOSE_LEAD_DELAY_MS,
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
    reduceMotion ? undefined : surfaceCloseLeadDelayMs / 1000,
  );
  // The shared element's transition is DIRECTION-AWARE. On the open it only
  // has to clear the growing sheet; on the close it has to arrive home
  // together with the collapsing disc, which it cannot do on the same spring
  // because the surface's close FLIP starts surfaceCloseLeadDelayMs later
  // than it does. `open` is the direction: it is already true when the open
  // morph's layout animation is created and already false when the close
  // morph's is, so reading it here picks the right spring by construction.
  // See DEFAULT_SHARED_CLOSE_SPRING for the derivation of the close default.
  const sharedProvided = transition?.shared;
  const sharedForDirection =
    sharedProvided && isSharedByDirection(sharedProvided)
      ? open
        ? sharedProvided.open
        : sharedProvided.close
      : (sharedProvided as Spring | Transition | undefined);
  const sharedTransition = mergeTransition(
    sharedForDirection,
    open ? DEFAULT_SHARED_SPRING : DEFAULT_SHARED_CLOSE_SPRING,
  );

  // ── Clock coupling (audit M2: "a ghost card leads the sheet on open") ─────
  // The shadow's collapseProgress clock and Motion's layout-projection clock
  // for the shared layoutId must START TOGETHER. They didn't, and the gap was
  // never a fixed number of frames — it scaled with how much work the page's
  // open commit did (measured: ~15ms on the generic example, ~24ms on the
  // flagship, both a LEAD, i.e. the shadow running ahead).
  //
  // Mechanism, from motion-dom 12.43's source rather than inference:
  //   * `time.now()` (frameloop/sync-time.mjs) is NOT performance.now() — it
  //     caches one timestamp per microtask checkpoint. A click handler, the
  //     React render/commit it triggers, and the passive effects React runs
  //     at the end of that same task all share ONE cached value, stamped
  //     whenever Motion first asked for the time in that task (pointer
  //     handling, well before the commit).
  //   * `animate(motionValue, …)` builds an AsyncMotionValueAnimation whose
  //     `createdAt = time.now()` becomes the underlying JSAnimation's
  //     `startTime` (AsyncMotionValueAnimation.mjs). Called from an effect,
  //     it therefore back-dates its start to the top of the click task.
  //   * Motion's own layout animation is created later, in the microtask
  //     `didUpdate() → microtask.read(scheduleUpdate)` schedules AFTER the
  //     commit (create-projection-node.mjs), where `frameData.timestamp` has
  //     been re-stamped — so it starts from a FRESH clock.
  // The delta between those two stamps is exactly the commit's own duration,
  // which is why the flagship (bigger tree, heavier commit) desynced ~1.6x
  // harder than the generic example, and why no constant frame offset could
  // ever fix it (the rejected double-rAF attempt overshot into a ~90px trail
  // for the same reason — it moved our start into a fresh, LATER task).
  //
  // The fix is structural, not a delay: arm the morph here, and let Motion's
  // own `onLayoutAnimationStart` (fired synchronously from JSAnimation's
  // play(), inside the frameloop pass that creates the projection animation)
  // pull the trigger. `time.now()` inside that callback returns the very
  // `frameData.timestamp` the projection animation stamped itself with, so
  // both clocks get an identical startTime by construction — on both the
  // open (Sheet's `.sheet` is the entering element) and the close (Disc's
  // `.discSurface` is), and for any consumer transition, delay included,
  // since both sides read the same transition object (D4).
  //
  // The same rule covers a RE-start: if the sheet's own box changes mid-morph
  // (a font landing, an image finishing), Motion abandons the layout
  // animation in flight and starts a fresh one from wherever the box is now,
  // at velocity 0, toward the new layout. Both curves are then
  // `start + (end - start) * g(t)` for the same normalized spring g, so the
  // shadow stays locked to the surface only if it restarts on the same frame
  // — hence startMorphClock re-fires for the whole duration of a morph, not
  // just once. `from` gates it to whichever element is the LEAD for this
  // direction (Sheet on open, Disc on close); the other one is a follow node
  // whose own layout animation must not re-time the morph.
  const morphRef = useRef<{
    to: number;
    transition: Transition;
    started: boolean;
  } | null>(null);
  const morphFallbackRafRef = useRef<number | null>(null);

  const startMorphClock = useCallback(
    (from: "disc" | "sheet") => {
      const morph = morphRef.current;
      if (!morph) return;
      if ((morph.to === 0) !== (from === "sheet")) return;
      // Already settled on target — an unrelated layout animation on an
      // idle disc/sheet, not a morph to re-time.
      if (morph.started && collapseProgress.get() === morph.to) return;
      morph.started = true;
      if (morphFallbackRafRef.current !== null) {
        cancelAnimationFrame(morphFallbackRafRef.current);
        morphFallbackRafRef.current = null;
      }
      // Cast: animate()'s MotionValue<number> overload wants motion-dom's
      // ValueAnimationTransition, which framer-motion doesn't re-export — the
      // transition here is the same public `Transition` shape used on
      // <motion.div transition>, just not nominally that type.
      //
      // velocity: 0 (not the inherited in-flight velocity Motion's animate()
      // uses by default — motion-dom's animateMotionValue reads
      // value.getVelocity() unless overridden). Motion's own layout-projection
      // spring — the one that actually moves the shared-layoutId surface —
      // always (re)starts its internal progress value at velocity: 0
      // (motion-dom create-projection-node.mjs startAnimation: `jump(0,
      // false)` then `animateSingleValue(…, { velocity: 0 })`,
      // unconditionally, every time). collapseProgress drives the shadow
      // layer on a separate clock; if it inherits the previous animation's
      // in-flight velocity instead of also restarting at 0, the two clocks
      // diverge from different starting velocities and settle apart — on a
      // reversal (Escape fired mid-open) and on a mid-morph relayout alike.
      animate(collapseProgress, morph.to, {
        ...morph.transition,
        velocity: 0,
      } as never);
    },
    [collapseProgress],
  );

  // Drive collapseProgress on genuine open/close transitions only — a
  // reference change on `transition` while the sheet is already open must
  // never re-trigger the bloom.
  //
  // A LAYOUT effect, deliberately: this only arms a ref and seeds a
  // MotionValue (no animate() call, so nothing side-effecting runs in the
  // render pass), and running during the commit is what guarantees the arm
  // lands BEFORE the microtask in which Motion creates the layout animation
  // and fires onLayoutAnimationStart. A passive effect happens to run first
  // on React 19 too, but only by scheduling accident; the ordering the fix
  // depends on should be the one React actually contracts.
  useLayoutEffect(() => {
    const wasOpen = prevOpenRef.current === true;
    prevOpenRef.current = open;
    const isOpening = open && !wasOpen;
    const isClosing = !open && wasOpen;
    if (!isOpening && !isClosing) return;

    if (reduceMotion) {
      morphRef.current = null;
      collapseProgress.jump(open ? 0 : 1);
      return;
    }

    // Only force collapseProgress to 1 when it isn't already mid-animation.
    // isOpening covers a cold open (collapseProgress already 1 by default)
    // and a settled close reopening (already at 1 from the prior close), so
    // the set(1) below is a no-op in both — but it ALSO fires when a tap
    // reopens the disc while a previous close is still animating (M11 made
    // that reachable: the backdrop no longer blocks the disc for the whole
    // close). In that case collapseProgress is mid-flight (e.g. 0.3, not 1),
    // and forcing it to 1 snaps the shadow/radius to fully-closed right
    // before startMorphClock re-arms an animation from that forced value,
    // producing a visible desync from the surface box (which Motion resumes
    // smoothly, with no equivalent reset). Skip the reset whenever an
    // animation is already running — the current in-flight value is the
    // correct starting point for the reversal, exactly like isClosing
    // already treats it with no reset at all.
    if (isOpening && !collapseProgress.isAnimating()) {
      collapseProgress.set(1);
    }
    morphRef.current = {
      to: isOpening ? 0 : 1,
      transition: isOpening ? openTransition : closeTransition,
      started: false,
    };
    // Fallback for the morphs Motion never reports a layout animation for:
    // a <Root defaultOpen> mount (nothing to FLIP from), or a layout that
    // measured unchanged. Cannot preempt the real trigger — Motion creates
    // the layout animation in a microtask after this commit, and a rAF
    // scheduled here cannot run until after that microtask has drained.
    if (morphFallbackRafRef.current !== null) {
      cancelAnimationFrame(morphFallbackRafRef.current);
    }
    const fallbackFrom = isOpening ? "sheet" : "disc";
    morphFallbackRafRef.current = requestAnimationFrame(() => {
      morphFallbackRafRef.current = null;
      if (!morphRef.current?.started) startMorphClock(fallbackFrom);
    });

    // If Root unmounts between this commit and the next paint (e.g. a
    // consumer's route change removes it right after a toggle), the
    // scheduled rAF above would otherwise fire after unmount and call
    // animate() on a dead tree — cancel it on cleanup.
    return () => {
      if (morphFallbackRafRef.current !== null) {
        cancelAnimationFrame(morphFallbackRafRef.current);
        morphFallbackRafRef.current = null;
      }
    };
  }, [
    open,
    collapseProgress,
    openTransition,
    closeTransition,
    reduceMotion,
    startMorphClock,
  ]);

  const [discRect, setDiscRect] = useState<Rect | null>(null);
  const [sheetRect, setSheetRect] = useState<SheetRect | null>(null);

  const triggerElRef = useRef<HTMLButtonElement | null>(null);
  const contentScrollElRef = useRef<HTMLDivElement | null>(null);

  // The single numeric-px border-radius MotionValue both crossfade
  // participants of the shared layoutId (audit M1) read — Sheet.tsx still
  // computes the actual hold/interpolation curve itself (unchanged from
  // pre-fix), then relays every tick into this stable container so
  // Disc.tsx's disc-surface can bind to the exact same painted values on
  // close. Owned here (not created fresh inside Sheet) purely so it's a
  // stable instance context can hand to both components regardless of
  // either one's mount lifecycle.
  const collapseRadius = useMotionValue(32);

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
    collapseRadius,
    discRect,
    setDiscRect,
    sheetRect,
    setSheetRect,
    sheetDragY,
    startMorphClock,
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
