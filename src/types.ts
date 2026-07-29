import type { ReactNode } from "react";
import type { MotionValue, Transition } from "motion/react";
import type { AnchorId } from "./anchors";

export type { AnchorId };

export interface Spring {
  stiffness: number;
  damping: number;
  mass?: number;
}

export interface MorphTransition {
  /** Disc to sheet. Default: { stiffness: 375, damping: 42.5, mass: 1.75 } */
  open?: Spring | Transition;
  /** Sheet to disc. Default: { stiffness: 240, damping: 34, mass: 1.75 } */
  close?: Spring | Transition;
  /** The <DiscSheet.Shared> element's own morph. Default: { stiffness: 500, damping: 45 } */
  shared?: Spring | Transition;
}

export interface RootProps {
  children: ReactNode;

  // Open state
  /** Uncontrolled initial state. Default false. */
  defaultOpen?: boolean;
  /** Controlled. When provided, the package never sets open itself. */
  open?: boolean;
  /** Fires on every requested state change, controlled or not. */
  onOpenChange?: (open: boolean) => void;

  // Position
  /** Uncontrolled initial anchor. Default "bottom-center". */
  defaultAnchor?: AnchorId;
  /** Fires after a drag settles on a new anchor. */
  onAnchorChange?: (anchor: AnchorId) => void;
  /** Default true. False renders a fixed disc with no drag affordance. */
  draggable?: boolean;
  /**
   * localStorage key for the chosen anchor.
   * Default "disc-sheet-anchor". Pass false to disable persistence entirely.
   */
  persistKey?: string | false;

  // Geometry
  /**
   * Disc diameter in px. Object form is a breakpoint ramp.
   * Default { base: 96, md: 128, xl: 144 } at 0 / 768 / 1600.
   */
  discSize?: number | { base: number; md?: number; xl?: number };
  /** Sheet max width in px. Default 480. */
  sheetMaxWidth?: number;

  // Motion
  transition?: MorphTransition;
  /** Force reduced-motion behavior. Default: the media query. */
  reduceMotion?: boolean;

  // Plumbing
  /** Base for generated aria ids and layoutIds. Default useId(). */
  id?: string;
  /** Base z-index. Default 100. */
  zIndex?: number;
  className?: string;
}

export interface DiscProps {
  children?: ReactNode;
  className?: string;
  /** Required. This is the button's accessible name. */
  "aria-label": string;
}

export type Labelled =
  | { "aria-label": string; "aria-labelledby"?: never }
  | { "aria-labelledby": string; "aria-label"?: never };

export type SheetProps = Labelled & {
  children: ReactNode;
  className?: string;
  /** Drag the sheet down past threshold to close. Default true. */
  dismissOnSwipe?: boolean;
  /** Click outside the sheet to close. Default true. */
  dismissOnBackdrop?: boolean;
};

export interface SharedProps {
  children: ReactNode;
  className?: string;
}

export interface ContentProps {
  children: ReactNode;
  className?: string;
}

export interface ItemProps {
  children: ReactNode;
  className?: string;
}

export interface CloseProps {
  children?: ReactNode;
  className?: string;
  "aria-label": string;
}

export interface ShadowProps {
  className?: string;
  /** Render a single child in place of the default shadow div, merging the
   * fixed positioning, z-index, aria-hidden, pointer-events, data-* attributes
   * and --disc-sheet-shadow-* custom properties onto it. */
  asChild?: boolean;
  children?: ReactNode;
}

export interface Rect {
  cx: number;
  cy: number;
  radius: number;
}

export interface SheetRect {
  cx: number;
  cy: number;
  halfWidth: number;
  halfHeight: number;
}

/** Public state + escape hatch returned by useDiscSheet(). */
export interface DiscSheetState {
  open: boolean;
  setOpen: (open: boolean) => void;
  anchor: AnchorId;
  isDragging: boolean;
  discSize: number;
  /** 0 = fully open (sheet), 1 = fully closed (disc). Live MotionValue. */
  collapseProgress: MotionValue<number>;
  /** Live viewport rects, null before first measure. */
  discRect: Rect | null;
  sheetRect: SheetRect | null;
}
