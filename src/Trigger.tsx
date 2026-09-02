"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { animate, motion, useMotionValue } from "motion/react";
import type { PanInfo } from "motion/react";
import { nearestAnchor, restingLeft, restingTop } from "./anchors";
import { SlotContext, useDiscSheetInternal } from "./context";
import { readVarPx } from "./readVarPx";
import { DRAG_THRESHOLD_PX, SNAP_SPRING } from "./motion";
import type { DiscProps } from "./types";
import styles from "./styles.module.css";

/**
 * <DiscSheet.Disc> — the fixed drag wrapper + trigger button + morph seed
 * surface.
 *
 * Single-origin position model (docs/PACKAGE-DESIGN.md §1, and the
 * `reference_floating-disc-single-origin-transform` landmine): the wrapper is
 * `position: fixed` at the viewport origin and positioned ENTIRELY by
 * Motion's x/y transform, holding the disc's top-left in viewport px.
 * Nothing ever changes CSS left/top after mount, so a snap is a plain x/y
 * animation with no FLIP and no one-frame transform desync.
 */
export function Disc({ children, className, ...aria }: DiscProps) {
  const ctx = useDiscSheetInternal("Disc");
  const {
    open,
    setOpen,
    anchor,
    setAnchor,
    setIsDragging,
    draggable,
    discSize,
    reduceMotion,
    triggerId,
    sheetId,
    setDiscRect,
    transition,
    triggerElRef,
    sheetRect,
    collapseRadius,
    startMorphClock,
  } = ctx;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const draggedRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);
  const lastRectRef = useRef<{ cx: number; cy: number; radius: number } | null>(
    null,
  );
  const rafRef = useRef<number | null>(null);
  // Set while <Sheet> is mounted (open, or closing but not yet exit-complete
  // — Sheet.tsx nulls this at onExitComplete). While it's non-null, disc-
  // surface may be mid-FLIP (it's the entering element on close), and this
  // wrapper's own x/y transform is an ANCESTOR of that FLIPping element —
  // jumping it instantly compounds with Motion's still-interpolating
  // projection transform on the child, producing a large multi-frame
  // desync. Defer the resize re-seat until the morph is provably over
  // rather than fighting it live.
  const pendingResizeRef = useRef(false);

  // Seed x/y at the anchor's resting position on mount and whenever the
  // anchor or disc size changes while the sheet is not being dragged.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const targetX = restingLeft(anchor, vpW, discSize);
    const targetY = restingTop(anchor, vpH, discSize);
    if (!mountedRef.current) {
      x.jump(targetX);
      y.jump(targetY);
      mountedRef.current = true;
    } else {
      x.jump(targetX);
      y.jump(targetY);
    }
  }, [anchor, discSize, x, y]);

  // Resize: re-seat the disc at its anchor's new resting position. While
  // <Sheet> is mounted (sheetRect !== null), defer instead of jumping now —
  // see pendingResizeRef above. The disc isn't visible in that window
  // anyway (its content is gated behind `{!open && ...}` below), so nothing
  // is lost by waiting; the flush effect re-seats at the CURRENT viewport
  // size once the morph settles.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      if (sheetRect !== null) {
        pendingResizeRef.current = true;
        return;
      }
      x.jump(restingLeft(anchor, window.innerWidth, discSize));
      y.jump(restingTop(anchor, window.innerHeight, discSize));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [anchor, discSize, sheetRect, x, y]);

  // Flush a deferred resize once the morph is over (sheetRect settles back
  // to null at Sheet's onExitComplete, or was never set — the open case
  // where a resize is deferred until the sheet later closes).
  useEffect(() => {
    if (sheetRect !== null) return;
    if (!pendingResizeRef.current) return;
    pendingResizeRef.current = false;
    if (typeof window === "undefined") return;
    x.jump(restingLeft(anchor, window.innerWidth, discSize));
    y.jump(restingTop(anchor, window.innerHeight, discSize));
  }, [anchor, discSize, sheetRect, x, y]);

  // The disc's RESTING shape, as a number Motion can mix from.
  //
  // Motion's shared-layout border-radius handling only sees a radius it
  // manages as an inline value — a CSS rule is invisible to it (the note on
  // the disc surface's style binding below). The morph binding used to be
  // scoped to `sheetRect !== null`, i.e. only while a sheet exists, which
  // left the disc carrying NO parseable radius at rest. So on every open,
  // Motion mixed the shape from 0 instead of from the circle: measured on
  // both example pages, the first painted frame of an open was the disc's
  // box (128x128, unmoved) painted with `border-radius: 0%` — a perfect
  // circle becoming a perfect square in one frame, before any growth was
  // visible, then rounding back up over the next ~300ms (roundness 1.00 ->
  // 0.00 -> 0.14 at +130ms). That pop was the single largest discontinuity
  // in the morph.
  //
  // Publishing the resting shape as a live numeric MotionValue fixes it at
  // the source and keeps every other resting guarantee: it equals
  // min(--disc-sheet-disc-radius, discSize / 2), which is a perfect circle
  // for the default 9999px token, honours a consumer's smaller override, and
  // re-derives on the disc-size ramp's own breakpoints (discSize is kept live
  // across resizes by useDiscSize). It is also exactly the value
  // useCollapseRadius's curve now ends a close on, so the handoff between the
  // two bound values is continuous — no frame where they disagree.
  const discRestRadius = useMotionValue(9999);
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const token = readVarPx(el, "--disc-sheet-disc-radius", 9999);
    discRestRadius.set(Math.min(token, discSize / 2));
  }, [discSize, discRestRadius, sheetRect, open]);

  // Report the disc's live rect for the escape hatch (usePKG().discRect) and
  // for Sheet's shadow-mask morph. Also writes --disc-sheet-disc-x/-y —
  // documented as package-written/consumer-readable — directly on the
  // wrapper without a React re-render, mirroring the source site's bloom-
  // tracking pattern.
  //
  // setDiscRect is React state on Root, so calling it synchronously here
  // would re-render the whole Root subtree on every pointer-move frame of a
  // drag. The imperative --disc-sheet-disc-x/-y writes stay per-frame; the
  // React commit is rAF-coalesced to at most once per frame and skipped
  // entirely when the rect hasn't moved by more than half a pixel.
  useEffect(() => {
    const commit = () => {
      rafRef.current = null;
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const next = {
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        radius: rect.width / 2,
      };
      const last = lastRectRef.current;
      if (
        last &&
        Math.abs(last.cx - next.cx) < 0.5 &&
        Math.abs(last.cy - next.cy) < 0.5 &&
        Math.abs(last.radius - next.radius) < 0.5
      ) {
        return;
      }
      lastRectRef.current = next;
      setDiscRect(next);
    };

    const update = () => {
      wrapperRef.current?.style.setProperty(
        "--disc-sheet-disc-x",
        `${x.get()}px`,
      );
      wrapperRef.current?.style.setProperty(
        "--disc-sheet-disc-y",
        `${y.get()}px`,
      );
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(commit);
      }
    };
    update();
    const unsubX = x.on("change", update);
    const unsubY = y.on("change", update);
    window.addEventListener("resize", update);
    return () => {
      unsubX();
      unsubY();
      window.removeEventListener("resize", update);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [x, y, setDiscRect]);

  const handleDragStart = useCallback(() => {
    draggedRef.current = true;
    setIsDragging(true);
  }, [setIsDragging]);

  const handleDragEnd = useCallback(
    (_e: unknown, info: PanInfo) => {
      setIsDragging(false);
      const vpW = typeof window !== "undefined" ? window.innerWidth : 1440;
      const vpH = typeof window !== "undefined" ? window.innerHeight : 900;

      const travel = Math.hypot(info.offset.x, info.offset.y);
      if (travel < DRAG_THRESHOLD_PX) {
        draggedRef.current = false;
        x.set(restingLeft(anchor, vpW, discSize));
        y.set(restingTop(anchor, vpH, discSize));
        return;
      }

      let pickedAnchor = anchor;
      const wrapper = wrapperRef.current;
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        pickedAnchor = nearestAnchor(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          vpW,
          vpH,
        );
      }

      const snapSpring = reduceMotion
        ? { type: "tween" as const, duration: 0 }
        : { type: "spring" as const, ...SNAP_SPRING };

      const targetX = restingLeft(pickedAnchor, vpW, discSize);
      const targetY = restingTop(pickedAnchor, vpH, discSize);

      if (pickedAnchor !== anchor) setAnchor(pickedAnchor);

      if (reduceMotion) {
        x.jump(targetX);
        y.jump(targetY);
      } else {
        animate(x, targetX, snapSpring);
        animate(y, targetY, snapSpring);
      }
    },
    [anchor, discSize, reduceMotion, setAnchor, x, y],
  );

  const handleClick = useCallback(() => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    setOpen(true);
  }, [setOpen]);

  return (
    <motion.div
      ref={(el) => {
        wrapperRef.current = el;
      }}
      className={`${styles.dragWrapper} ${className ?? ""}`}
      // width/height come from .dragWrapper's CSS rule (var(--disc-sheet-
      // disc-size)), not an inline write of `discSize` — an inline write
      // here would win over Root's scoped @media block regardless of
      // viewport, reproducing D3 one level down (this element is the
      // ancestor .shared[data-disc-sheet-slot="disc"] inherits from). `x`/
      // `y` still come from the live discSize for position math (anchors.ts)
      // — that's unaffected by D3, which is a BOX-SIZE defect, not a
      // position one.
      style={{ x, y }}
      data-disc-sheet-part="disc-root"
      // Lift the disc's stacking context above the sheet's for the duration
      // of a CLOSE. `.dragWrapper` is `position: fixed` with a z-index, so it
      // is a stacking context: everything inside it — including the disc-side
      // <Shared> instance — is capped at `--disc-sheet-z` (100) and painted
      // under the sheet at z + 102.
      //
      // That cap put a hole in the middle of every close. The two layoutId
      // pairs crossfade on DIFFERENT springs: `-shared` runs on
      // transition.shared (500/45 on open, DEFAULT_SHARED_CLOSE_SPRING on
      // close), `-surface` on transition.close plus
      // SURFACE_CLOSE_LEAD_DELAY_MS. Measured per frame on both example
      // pages, the sheet-side <Shared> had faded to opacity 0 by 229ms while
      // the sheet element it sits on was STILL at opacity 1 until 246ms —
      // and the disc-side copy, already at opacity 1 since 87ms and exactly
      // co-located, was underneath that opaque sheet background. Composited
      // visibility of the shared element at its worst frame (screencast
      // pixels sampled at its live centre, 1.0 = its own colour, 0.0 = fully
      // washed to the surface behind it): 0.021 on index at 238ms, 0.000 on
      // flagship at 238ms. The crossfade was correct; the compositing was
      // not — a circle that vanished and came back.
      //
      // Lifting the wrapper to z + 103 lets the disc-side copy paint through,
      // so it covers the gap the sheet-side copy leaves: worst frame 0.987
      // (index) / 0.981 (flagship). Both surfaces are the same
      // --disc-sheet-surface, co-located and same-radius by construction
      // mid-FLIP, so the reordered pair reads identically; the sheet's
      // content is already at opacity 0 by 80ms (CONTENT_FADE_OUT_MS), long
      // before disc-surface has any opacity at all (0 until 121ms).
      //
      // Gated to the close, NOT to `sheetRect !== null`: while the sheet is
      // OPEN this button still renders (only its children are behind
      // `{!open && ...}`), so lifting it then would float an invisible
      // disc-size hit target over the open sheet and swallow its clicks.
      data-disc-sheet-closing={sheetRect !== null && !open ? "" : undefined}
      drag={draggable && !open ? true : false}
      dragMomentum={false}
      dragElastic={reduceMotion ? 0 : 0.06}
      dragConstraints={{
        left: 0,
        right: typeof window !== "undefined" ? window.innerWidth - discSize : 0,
        top: 0,
        bottom:
          typeof window !== "undefined" ? window.innerHeight - discSize : 0,
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <button
        ref={(el) => {
          triggerRef.current = el;
          triggerElRef.current = el;
        }}
        type="button"
        className={styles.discTrigger}
        data-disc-sheet-part="disc-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? sheetId : undefined}
        id={triggerId}
        onClick={handleClick}
        {...aria}
      >
        {!open && (
          <motion.div
            ref={surfaceRef}
            layoutId={reduceMotion ? undefined : `${ctx.idBase}-surface`}
            className={styles.discSurface}
            // This disc surface is the ENTERING element on close (it is
            // gated behind `{!open && ...}`, so it mounts only once open
            // flips false), and with a shared layoutId the entering side's
            // transition governs the FLIP. This must be transition.close,
            // not transition.open — see the matching note on Sheet.tsx's
            // layoutId transition for why the transposition mattered.
            transition={transition.close}
            // audit M2: this element is the entering side of the shared
            // layoutId on CLOSE, so it is the close's equivalent of Sheet's
            // own onLayoutAnimationStart — it starts Root's collapseProgress
            // clock inside the same frameloop pass that creates Motion's
            // layout animation, so both share a start time. No-op unless Root
            // has a morph armed. See Root.tsx's clock-coupling note.
            onLayoutAnimationStart={() => startMorphClock("disc")}
            data-disc-sheet-part="disc-surface"
            // Framer Motion's shared-layout border-radius correction only
            // tracks a border-radius it manages as an inline style value —
            // it can't see the CSS module's border-radius rule. Without this,
            // the crossfade handoff from <Sheet>'s animated borderRadius
            // writes an inline `border-radius: 0` here once the FLIP settles,
            // leaving the disc square.
            //
            // audit M1: this used to be a `var()` STRING, which Motion can't
            // parse or scale-correct, so it painted the literal 9999px
            // fallback on a sheet-sized box for the whole close regardless of
            // what RADIUS_HOLD_FRACTION/RADIUS_CLOSE_DELAY_SEC intended. The
            // fix is `ctx.collapseRadius`, a numeric MotionValue Sheet.tsx
            // relays its own hold/interpolation curve into (context.ts,
            // useCollapseRadius.ts) — bound here through Motion's `style`
            // prop specifically, not written imperatively via a ref+effect.
            // Disc re-renders on every context change (Root's context value
            // isn't memoized), and React's own reconciler re-applies a plain
            // `style` prop's string value on each such render, clobbering any
            // manual `el.style.borderRadius` write between "change" events —
            // an earlier version of this fix did exactly that and silently
            // regressed the close back to painting ~9999px most frames
            // (caught by geometry.spec.ts's own test (k), added for this
            // fix). Binding it as a MotionValue keeps Motion itself
            // responsible for every write, bypassing React's render diff.
            //
            // This line was once believed to cost geometry.spec.ts's
            // shadow-vs-surface CLOSE gate 6.1-7.4px against its 6px bound
            // (the theory being that a SECOND layoutId node carrying a live
            // numeric radius doubled Motion's per-frame correction work). It
            // does not. That overage was M2 — the shadow's collapseProgress
            // clock and Motion's layout-projection clock starting from two
            // different timestamps, an error whose magnitude scaled with how
            // much work the close commit did, which is why adding work here
            // looked causal. With the two clocks coupled (Root.tsx's
            // startMorphClock) the close measures 0.1-0.4px worst |Δtop| on
            // both example pages at every tested viewport with this binding
            // live and unchanged.
            //
            // Scoped to `sheetRect !== null` (mirrors the same signal
            // Disc.tsx's own pendingResizeRef logic above already uses for
            // "Sheet is mounted — open, or closing but not yet exit-
            // complete") rather than bound unconditionally: collapseRadius's
            // hold/gate mechanism (RADIUS_CLOSE_DELAY_SEC, motion.ts) is
            // TIME-based, not tied to when a close visually finishes, so for
            // up to ~1.4s after a normal-speed close settles (and on first
            // page load, before any open has ever happened) it still reads
            // the SHEET's rounded-rect radius, not the disc's circular one —
            // caught visually (a squared-off disc at rest) before this
            // guard existed. Once Sheet's onExitComplete nulls sheetRect
            // (the morph is provably over), this falls back to `undefined`
            // and the CSS module's own resting default
            // (`var(--disc-sheet-disc-radius, 9999px)`, styles.module.css)
            // takes over — correct immediately, no 1.4s lag.
            style={{
              borderRadius:
                sheetRect !== null ? collapseRadius : discRestRadius,
            }}
          />
        )}
        {!open && (
          <SlotContext.Provider value="disc">{children}</SlotContext.Provider>
        )}
      </button>
    </motion.div>
  );
}
