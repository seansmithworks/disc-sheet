import type { Transition } from "motion/react";
import type { Spring, SharedTransitionByDirection } from "./types";

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

/**
 * Retuned 2026-08-31 for the close-duration target (was 240 / 34 / 1.75).
 *
 * The damping RATIO is deliberately preserved — 0.830 before, 0.826 after —
 * so the character of the close is unchanged and only its rate moves. What
 * changed is the natural frequency: mass 1.75 -> 1.0 with stiffness
 * 240 -> 375 takes wn from 11.71 to 19.36 rad/s, which is the whole of the
 * speed-up. Measured settle to within 0.2px of the resting disc went from
 * 893ms to 471ms on the prod consumer app.
 *
 * Still underdamped, so the box still overshoots its target by ~0.94% of
 * travel (3.3px) on the way in. That overshoot lands on a 128px disc rather
 * than the 480px sheet, which is why it reads as a brief ellipse at the end
 * of a close and does not read as anything on the open. Making the close
 * critically damped would remove it; that was explicitly NOT part of this
 * change and is recorded as a recommendation instead.
 */
export const DEFAULT_CLOSE_SPRING: Spring = {
  stiffness: 375,
  damping: 32,
  mass: 1,
};

/**
 * OPEN-direction shared spring. Stiff and near-critically damped (wn 22.4,
 * damping ratio 1.006) so the shared element clears the growing sheet without
 * overshoot.
 */
export const DEFAULT_SHARED_SPRING: Spring = {
  stiffness: 500,
  damping: 45,
};

/**
 * CLOSE-direction shared spring — DERIVED from DEFAULT_CLOSE_SPRING so the
 * shared element and the surface box land together ("one clock").
 *
 * The problem it fixes: the shared element runs its own layoutId animation
 * with no delay, while the surface's close FLIP is deliberately handicapped by
 * SURFACE_CLOSE_LEAD_DELAY_MS. Two independent clocks, one of them started
 * ~112ms later (the delay plus the click-to-projection-start frame), so the
 * shared element parked at its resting box while the disc was still
 * contracting and ringing underneath it. Measured on the prod consumer app at
 * 1280x800: box arrived 575ms after the Close click, shared element 400ms —
 * a 175ms gap, i.e. the avatar finished a sixth of a second early and then sat
 * there while the disc breathed around it.
 *
 * The derivation is the same frequency-scaling trick DEFAULT_OPEN_SPRING uses
 * (docs/PACKAGE-DESIGN.md §3): scale stiffness by k^2 and damping by k, which
 * leaves the damping RATIO untouched and moves only the natural frequency, so
 * the character of the motion is unchanged and only its rate moves. Here
 * k = Ts / (Ts + D): the shared element starts D earlier than the surface, so
 * it must take D longer to settle. With Ts ~= 431ms of surface travel and
 * D ~= 36ms of head start (SURFACE_CLOSE_LEAD_DELAY_MS plus the
 * click-to-projection-start frame), k = 0.902.
 *
 *   stiffness 375 * 0.902^2 = 305      damping 32 * 0.902 = 28.9      mass 1
 *
 * THIS CONSTANT IS DERIVED FROM SURFACE_CLOSE_LEAD_DELAY_MS. Change that and
 * this has to be re-derived, or the shared element starts trailing the box
 * and spills out past the disc's edge.
 *
 * Damping ratio 0.826 before and after, matched to the close spring's, so the
 * shared element rings in sympathy with the box rather than against it — that
 * is what keeps the 2px border relationship intact through the surface
 * spring's overshoot tail instead of pinching to ~0 and re-opening.
 *
 * It still LEADS: a spring covers most of its travel early, so with a 112ms
 * head start the shared element is well ahead of the box through the middle of
 * the close (which is what SURFACE_CLOSE_LEAD_DELAY_MS buys — the close reads
 * as a re-home, not a scale). It just no longer finishes early.
 */
export const DEFAULT_SHARED_CLOSE_SPRING: Spring = {
  stiffness: 305,
  damping: 28.9,
  mass: 1,
};

/** Overdamped snap spring for the disc's drag-end anchor snap. Not a prop. */
export const SNAP_SPRING: Spring = { stiffness: 700, damping: 52, mass: 1 };

// ── Internal choreography constants (docs/PACKAGE-DESIGN.md §3) ────────────
// Every one of these exists to suppress a specific artifact. None are props.

/** Fraction of the close progress spent holding sheetRadius before the shape
 * starts rounding toward the disc. Prevents an over-rounded rectangle from
 * appearing before the box has actually contracted. Progress-based, not
 * time-based, so it holds correctly however long a consumer's close spring
 * runs — the wall-clock RADIUS_CLOSE_DELAY_SEC that used to sit on top of it
 * was longer than a close takes, which suppressed this hold entirely and left
 * the disc resting on the sheet's radius (see useCollapseRadius.ts). */
export const RADIUS_HOLD_FRACTION = 0.74;

/**
 * Delay (ms) before the surface box begins its close FLIP, so the shared
 * element visibly leads the shrink instead of scaling in lockstep.
 *
 * STRAWMAN 2026-08-31, was 100 — Sean's call, one line to revert (and see
 * the warning on DEFAULT_SHARED_CLOSE_SPRING, which is derived from this).
 * It is the single biggest lever on close duration, and at 100 it bought
 * more re-home read than the close could afford. Measured on a prod build
 * at 1280x800, medians of 3:
 *
 *   100ms: box frozen 143ms (8.6 frames) after the Close click, shared
 *          element gets a 100ms (6.0 frame) head start and is 53% of the way
 *          home before the sheet starts collapsing. Total close 573ms.
 *    35ms: box frozen 76ms (4.6 frames), head start 36ms (2.1 frames),
 *          shared element 17% of the way home. Total close 507ms.
 *     0ms: box frozen 43ms (2.5 frames), no head start at all, shared
 *          element 1% home — the lockstep scale this constant exists to
 *          prevent. Total close 476ms.
 *
 * So 35 keeps the detachment legible (the avatar still visibly leaves first)
 * and returns 66ms — four frames — of close duration.
 */
export const SURFACE_CLOSE_LEAD_DELAY_MS = 35;

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

/**
 * Narrow `transition.shared` to its per-direction `{ open, close }` form. A
 * directional object carries one of those keys and none of a Transition's or a
 * Spring shorthand's own discriminators.
 */
export function isSharedByDirection(
  value: Spring | Transition | SharedTransitionByDirection,
): value is SharedTransitionByDirection {
  return (
    !("type" in value) &&
    !("stiffness" in value) &&
    !("duration" in value) &&
    ("open" in value || "close" in value)
  );
}

function isSpringShorthand(value: Spring | Transition): value is Spring {
  return (
    "stiffness" in value &&
    "damping" in value &&
    !("type" in value) &&
    !("duration" in value)
  );
}
