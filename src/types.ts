import type { ReactNode } from "react";
import type { MotionValue, Transition } from "motion/react";
import type { AnchorId } from "./anchors";

export type { AnchorId };

export interface StiffnessSpring {
  stiffness: number;
  damping: number;
  mass?: number;
}

/** Motion's designer-legible spring shorthand — two numbers instead of
 * stiffness/damping. `visualDuration` is spring-only in Motion (a tween
 * never carries it), which is what lets mergeTransition tell this apart
 * from a full Transition without a `type` key on either shape.
 *
 * No `mass` here, deliberately: Motion's spring resolver checks for
 * `stiffness`/`damping`/`mass` FIRST, before it ever looks at
 * `visualDuration`/`bounce`, so a `mass` key silently discards both and
 * falls back to Motion's own defaults (stiffness 100 / damping 10).
 * Measured on a 0->100 keyframe: `{visualDuration:0.4, bounce:0.2}` settles
 * in 660ms; the same object plus `mass:1.75` settles in 2080ms, with no
 * error and no warning. `bounce` is required, not optional, for the
 * opposite reason — see mergeTransition's isSpringShorthand comment. */
export interface DurationSpring {
  visualDuration: number;
  bounce: number;
}

export type Spring = StiffnessSpring | DurationSpring;

/** Per-direction override for <MorphSheet.Shared>. Either key may be omitted;
 * the package default for that direction is used instead. */
export interface SharedTransitionByDirection {
  open?: Spring | Transition;
  close?: Spring | Transition;
}

export interface MorphTransition {
  /** Trigger to sheet. Default: { stiffness: 375, damping: 42.5, mass: 1.75 } */
  open?: Spring | Transition;
  /** Sheet to trigger. Default: { stiffness: 375, damping: 32, mass: 1 } */
  close?: Spring | Transition;
  /**
   * The <MorphSheet.Shared> element's own morph. Direction-aware, because the
   * two directions have different jobs: on the open the shared element only
   * has to clear the growing sheet, on the close it has to arrive home
   * together with the collapsing trigger.
   *
   * A single Spring/Transition applies to BOTH directions. Pass
   * `{ open, close }` to set them independently.
   *
   * Defaults: open { stiffness: 500, damping: 45 },
   *           close { stiffness: 340, damping: 30, mass: 1 }.
   */
  shared?: Spring | Transition | SharedTransitionByDirection;
}

/**
 * A named feel, carrying exactly the two fields the tuner can actually
 * export ({@link MorphTransition} and the surface close lead delay —
 * `triggerSize` is a separate geometry prop, not part of a feel). Explicit
 * `transition`/`surfaceCloseLeadDelayMs` props on Root win over a preset,
 * field by field — see RootProps.preset.
 */
export interface MotionPreset {
  transition?: MorphTransition;
  surfaceCloseLeadDelayMs?: number;
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
  /** Default true. False renders a fixed trigger with no drag affordance. */
  draggable?: boolean;
  /**
   * localStorage key for the chosen anchor.
   * Default "morph-sheet-anchor". Pass false to disable persistence entirely.
   */
  persistKey?: string | false;

  // Geometry
  /**
   * Trigger diameter in px. Object form is a breakpoint ramp.
   * Default { base: 96, md: 128, xl: 144 } at 0 / 768 / 1600.
   */
  triggerSize?: number | { base: number; md?: number; xl?: number };
  /** Sheet max width in px. Default 480. */
  sheetMaxWidth?: number;

  // Motion
  /**
   * A named feel from `presets` (or a hand-built {@link MotionPreset}).
   * `transition` and `surfaceCloseLeadDelayMs` below win over it field by
   * field — pass `preset={presets.snappy} transition={{ open: mySpring }}`
   * to take snappy's close/shared and override only open.
   */
  preset?: MotionPreset;
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
   * shared element starts trailing the box and spills past the round
   * trigger's 2px border.
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

export interface TriggerProps {
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
   * and --morph-sheet-shadow-* custom properties onto it. */
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

/** Public state + escape hatch returned by useMorphSheet(). */
export interface MorphSheetState {
  open: boolean;
  setOpen: (open: boolean) => void;
  anchor: AnchorId;
  isDragging: boolean;
  triggerSize: number;
  /** 0 = fully open (sheet), 1 = fully closed (trigger). Live MotionValue. */
  collapseProgress: MotionValue<number>;
  /** Live viewport rects, null before first measure. */
  triggerRect: Rect | null;
  sheetRect: SheetRect | null;
}
