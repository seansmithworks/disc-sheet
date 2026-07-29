import { createContext, useContext } from "react";
import type { MutableRefObject } from "react";
import type { MotionValue, Transition } from "motion/react";
import type { AnchorId } from "./anchors";
import type { DiscSheetState, Rect, SheetRect } from "./types";

/**
 * Internal context value — everything Disc, Sheet, Shared, Content, Close and
 * Shadow need to coordinate, plus the subset re-exported publicly by
 * useDiscSheet(). Keeping the internal shape richer than the public one means
 * widening usePKG() later (if ever needed) is additive, not a breaking change.
 */
export interface DiscSheetContextValue extends DiscSheetState {
  setAnchor: (anchor: AnchorId) => void;
  onAnchorChange?: (anchor: AnchorId) => void;
  setIsDragging: (dragging: boolean) => void;
  draggable: boolean;
  sheetMaxWidth: number;
  reduceMotion: boolean;
  zIndex: number;
  idBase: string;
  triggerId: string;
  sheetId: string;
  transition: {
    open: Transition;
    close: Transition;
    shared: Transition;
  };
  setDiscRect: (rect: Rect | null) => void;
  setSheetRect: (rect: SheetRect | null) => void;
  /** Dev-only: Close registers itself here so Root can warn if the sheet
   * opens with no visible close control rendered. */
  registerClose: () => () => void;
  hasRegisteredClose: () => boolean;
  /** The disc trigger button element — Sheet focuses it back on exit-complete. */
  triggerElRef: MutableRefObject<HTMLButtonElement | null>;
  /** The Content scroll region element — Sheet's swipe-to-close must not fire
   * while this is mid-scroll (docs/PACKAGE-DESIGN.md §1, Content). */
  contentScrollElRef: MutableRefObject<HTMLDivElement | null>;
}

export const DiscSheetContext = createContext<DiscSheetContextValue | null>(
  null,
);

/**
 * SlotContext — the disc/sheet slot discriminator. Provided by <Disc> and
 * <Sheet> around their children, read by <Shared> to decide which of the two
 * shapes it renders (docs/PACKAGE-DESIGN.md's B2/M7 fix): the disc-side
 * instance is an inset, circular clip; the sheet-side instance is an in-flow,
 * margined circle. One mechanism serves both findings.
 */
export type DiscSheetSlot = "disc" | "sheet";

export const SlotContext = createContext<DiscSheetSlot | null>(null);

export function useDiscSheetSlot(): DiscSheetSlot | undefined {
  const slot = useContext(SlotContext);
  return slot ?? undefined;
}

/**
 * useDiscSheet — the public escape hatch. Throws outside <DiscSheet.Root>.
 *
 * usePKG().collapseProgress is the raw MotionValue the package's own radius,
 * mask and opacity transforms read (0 = fully open, 1 = fully closed).
 * Combined with discRect/sheetRect, it is enough to rebuild any of the
 * internal choreography externally — see example/CloseMask.tsx.
 */
export function useDiscSheet(): DiscSheetState {
  const ctx = useContext(DiscSheetContext);
  if (!ctx) {
    throw new Error(
      "useDiscSheet() must be called from inside <DiscSheet.Root>.",
    );
  }
  const {
    open,
    setOpen,
    anchor,
    isDragging,
    discSize,
    collapseProgress,
    discRect,
    sheetRect,
  } = ctx;
  return {
    open,
    setOpen,
    anchor,
    isDragging,
    discSize,
    collapseProgress,
    discRect,
    sheetRect,
  };
}

/** Internal-only accessor, used by the compound components themselves. */
export function useDiscSheetInternal(
  componentName: string,
): DiscSheetContextValue {
  const ctx = useContext(DiscSheetContext);
  if (!ctx) {
    throw new Error(
      `<DiscSheet.${componentName}> must be rendered inside <DiscSheet.Root>.`,
    );
  }
  return ctx;
}

export type { MotionValue };
