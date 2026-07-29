"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { useDiscSize } from "./useDiscSize";
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

  const [isDragging, setIsDragging] = useState(false);

  const systemReduceMotion = useReducedMotion();
  const reduceMotion = reduceMotionProp ?? Boolean(systemReduceMotion);

  // ── The morph clock ────────────────────────────────────────────────────
  // collapseProgress: 0 = fully open (sheet), 1 = fully closed (disc). Owned
  // here so Disc, Sheet, Shared and Shadow all read the same live value —
  // this is the MotionValue usePKG() exposes as the escape hatch (§3).
  const collapseProgress = useMotionValue(1);
  const prevOpenRef = useRef<boolean | null>(null);

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

  const drivenOpenTransition = useMemo(
    () => ({ ...openTransition, delay: 0 }),
    [openTransition],
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
      // drivenOpenTransition is the same public `Transition` shape used on
      // <motion.div transition>, just not nominally that type.
      animate(collapseProgress, 0, drivenOpenTransition as never);
    } else {
      animate(collapseProgress, 1, closeTransition as never);
    }
  }, [
    open,
    collapseProgress,
    drivenOpenTransition,
    closeTransition,
    reduceMotion,
  ]);

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

  return (
    <DiscSheetContext.Provider value={contextValue}>
      <LayoutGroup id={idBase}>
        <div
          className={className}
          data-disc-sheet-root=""
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
            ["--disc-sheet-disc-size" as string]: `${discSize}px`,
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
