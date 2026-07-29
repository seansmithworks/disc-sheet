"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { animate, motion, useMotionValue } from "motion/react";
import type { PanInfo } from "motion/react";
import { nearestAnchor, restingLeft, restingTop } from "./anchors";
import { SlotContext, useDiscSheetInternal } from "./context";
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
  } = ctx;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const draggedRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const mountedRef = useRef(false);
  const lastRectRef = useRef<{ cx: number; cy: number; radius: number } | null>(
    null,
  );
  const rafRef = useRef<number | null>(null);

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

  // Resize: re-seat the disc at its anchor's new resting position.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      x.jump(restingLeft(anchor, window.innerWidth, discSize));
      y.jump(restingTop(anchor, window.innerHeight, discSize));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [anchor, discSize, x, y]);

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
      style={{
        x,
        y,
        width: discSize,
        height: discSize,
        ["--disc-sheet-disc-size" as string]: `${discSize}px`,
      }}
      data-disc-sheet-part="disc-root"
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
            layoutId={reduceMotion ? undefined : `${ctx.idBase}-surface`}
            className={styles.discSurface}
            transition={transition.open}
            data-disc-sheet-part="disc-surface"
            // Framer Motion's shared-layout border-radius correction only
            // tracks a border-radius it manages as an inline style value —
            // it can't see the CSS module's border-radius rule. Without this,
            // the crossfade handoff from <Sheet>'s animated borderRadius
            // writes an inline `border-radius: 0` here once the FLIP settles,
            // leaving the disc square. Mirrors Sheet.tsx's own inline
            // `style={{ borderRadius }}`.
            style={{ borderRadius: "var(--disc-sheet-disc-radius, 9999px)" }}
          />
        )}
        {!open && (
          <SlotContext.Provider value="disc">{children}</SlotContext.Provider>
        )}
      </button>
    </motion.div>
  );
}
