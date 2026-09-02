import type { ReactNode } from "react";
import type { MotionValue, Transition } from "motion/react";
import type { AnchorId } from "./anchors";

export type { AnchorId };

export interface Spring {
  stiffness: number;
  damping: number;
  mass?: number;
}

/** Per-direction override for <DiscSheet.Shared>. Either key may be omitted;
 * the package default for that direction is used instead. */
export interface SharedTransitionByDirection {
  open?: Spring | Transition;
  close?: Spring | Transition;
}

export interface MorphTransition {
  /** Disc to sheet. Default: { stiffness: 375, damping: 42.5, mass: 1.75 } */
  open?: Spring | Transition;
  /** Sheet to disc. Default: { stiffness: 375, damping: 32, mass: 1 } */
  close?: Spring | Transition;
  /**
   * The <DiscSheet.Shared> element's own morph. Direction-aware, because the
   * two directions have different jobs: on the open the shared element only
   * has to clear the growing sheet, on the close it has to arrive home
   * together with the collapsing disc.
   *
   * A single Spring/Transition applies to BOTH directions. Pass
   * `{ open, close }` to set them independently.
   *
   * Defaults: open { stiffness: 500, damping: 45 },
   *           close { stiffness: 340, damping: 30, mass: 1 }.
   */
  shared?: Spring | Transition | SharedTransitionByDirection;
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
  /**
   * Delay (ms) before the surface box begins its close FLIP, so the shared
   * element visibly leads the shrink instead of scaling in lockstep. Default
   * 35. Ignored under reduced motion.
   *
   * `transition.shared.close` was formerly derived from this value; as of
   * Sean's "Version 4" dial pass it is an independently dialled value, not a
   * formula output — the two are coupled by feel, not by computation. This
   * prop has no automatic compensation: if you change it, `transition.shared.close`
   * must be re-dialled to match (on the /tune panel, not recomputed), or the
   * shared element starts trailing the box and spills past the disc's 2px
   * border.
   */
  surfaceCloseLeadDelayMs?: number;
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
