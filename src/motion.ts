import type { Transition } from "motion/react";
import type { Spring } from "./types";

/**
 * Default springs, verified against the source site's dialed values
 * (docs/PACKAGE-DESIGN.md §3). Each is exposed as a prop (transition.open /
 * .close / .shared); everything below the "internal" line is deliberately
 * NOT a prop — see §3's rationale for why each one stays a fixed constant.
 */
export const DEFAULT_OPEN_SPRING: Spring = {
  stiffness: 375,
  damping: 42.5,
  mass: 1.75,
};

export const DEFAULT_CLOSE_SPRING: Spring = {
  stiffness: 240,
  damping: 34,
  mass: 1.75,
};

export const DEFAULT_SHARED_SPRING: Spring = {
  stiffness: 500,
  damping: 45,
};

/** Overdamped snap spring for the disc's drag-end anchor snap. Not a prop. */
export const SNAP_SPRING: Spring = { stiffness: 700, damping: 52, mass: 1 };

// ── Internal choreography constants (docs/PACKAGE-DESIGN.md §3) ────────────
// Every one of these exists to suppress a specific artifact. None are props.

/** Fraction of the close progress spent holding sheetRadius before the shape
 * starts rounding toward the disc. Prevents an over-rounded rectangle from
 * appearing before the box has actually contracted. */
export const RADIUS_HOLD_FRACTION = 0.74;

/** Seconds to hold the previous radius state before a close begins rounding —
 * matched to a ~480px sheet; see docs/PACKAGE-DESIGN.md §7C for the known
 * soft spot on very different sheet sizes. */
export const RADIUS_CLOSE_DELAY_SEC = 1.5;

/** Delay (ms) before the surface box begins its close FLIP, so the shared
 * element visibly leads the shrink instead of scaling in lockstep. */
export const SURFACE_CLOSE_LEAD_DELAY_MS = 100;

/** Delay (s) before sheet content starts revealing after the open bloom. */
export const OPEN_CONTENT_REVEAL_DELAY_SEC = 0.2;

/** Content fade-out duration + delay (ms) on close, so content clears before
 * the box visibly collapses under it. */
export const CONTENT_FADE_OUT_MS = 80;
export const CONTENT_FADE_OUT_DELAY_MS = 0;

/** Stagger interval (s) between <DiscSheet.Item> children. */
export const ITEM_STAGGER_INTERVAL_SEC = 0.04;

/** Drag-vs-tap threshold, px. */
export const DRAG_THRESHOLD_PX = 5;

/** Swipe-to-close thresholds. */
export const SWIPE_OFFSET_PX = 96;
export const SWIPE_VELOCITY_PX_S = 400;

/**
 * mergeTransition — a Spring shorthand or full Transition, falling back to a
 * default. Composes a `delay` onto the result only if the consumer did not
 * already specify one.
 */
export function mergeTransition(
  provided: Spring | Transition | undefined,
  fallback: Spring,
  delay?: number,
): Transition {
  const base: Transition = provided
    ? isSpringShorthand(provided)
      ? { type: "spring", ...provided }
      : provided
    : { type: "spring", ...fallback };

  if (delay === undefined) return base;
  return "delay" in base && base.delay !== undefined
    ? base
    : { ...base, delay };
}

function isSpringShorthand(value: Spring | Transition): value is Spring {
  return (
    "stiffness" in value &&
    "damping" in value &&
    !("type" in value) &&
    !("duration" in value)
  );
}
