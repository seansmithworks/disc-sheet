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
 * DIALLED 2026-08-31 by Sean on the /tune dialkit panel, saved as "Version 4"
 * (docs/tuning/dialkit-morph-sheet-close.json). This is a judged value, not a
 * derived one — it supersedes the k = 0.92 "slow the shell down" strawman
 * (317.4 / 29.44 / 1), which he tried and rejected by dialling the shell back
 * to exactly where Phase 4 had it.
 *
 * ── history ──
 * Retuned 2026-08-31 for the close-duration target (was 240 / 34 / 1.75).
 *
 * The damping RATIO is deliberately preserved — 0.830 before, 0.826 after —
 * so the character of the close is unchanged and only its rate moves. What
 * changed is the natural frequency: mass 1.75 -> 1.0 with stiffness
 * 240 -> 375 takes wn from 11.71 to 19.36 rad/s, which is the whole of the
 * speed-up. Measured settle to within 0.2px of the resting trigger went from
 * 893ms to 471ms on the prod consumer app.
 *
 * Still underdamped, so the box still overshoots its target by ~0.94% of
 * travel (3.3px) on the way in. That overshoot lands on a 128px trigger rather
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
 * CLOSE-direction shared spring — independently dialled to land together
 * with DEFAULT_CLOSE_SPRING ("one clock"). It was ORIGINALLY derived from
 * DEFAULT_CLOSE_SPRING by formula; as of Sean's "Version 4" dial pass below
 * it no longer is. The derivation history is kept because it explains how
 * the pair was first reached, not because it still governs the shipped
 * numbers — see the NOT derived note further down.
 *
 * The problem it fixes: the shared element runs its own layoutId animation
 * with no delay, while the surface's close FLIP is deliberately handicapped by
 * SURFACE_CLOSE_LEAD_DELAY_MS. Two independent clocks, one of them started
 * ~112ms later (the delay plus the click-to-projection-start frame), so the
 * shared element parked at its resting box while the trigger was still
 * contracting and ringing underneath it. Measured on the prod consumer app at
 * 1280x800: box arrived 575ms after the Close click, shared element 400ms —
 * a 175ms gap, i.e. the avatar finished a sixth of a second early and then sat
 * there while the trigger breathed around it.
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
 * THAT WAS THE ORIGINAL DERIVATION. It no longer holds — see the "NOT derived"
 * note further down this comment, which supersedes it. This constant and
 * SURFACE_CLOSE_LEAD_DELAY_MS are now an independently dialled pair, coupled
 * by feel rather than formula: change one and the other must be re-dialled
 * on /tune, not recomputed, or the shared element starts trailing the box
 * and spills out past the trigger's edge.
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
 *
 * DIALLED 2026-08-31 by Sean on the /tune dialkit panel, saved as "Version 4"
 * (docs/tuning/dialkit-morph-sheet-close.json). A judged value: he asked for a
 * SLOWER avatar, was given the k = 0.85 strawman (220.3625 / 24.565 / 1), and
 * dialled back past the derived pair to something FASTER than either — wn
 * 18.44 rad/s here, against 17.46 for the k = 0.902 derived value and 14.85
 * for the strawman he rejected.
 *
 * NOT derived, and the k = Ts/(Ts+D) relation documented above no longer
 * holds for this pair. Deriving from the shell would give 340 -> damping
 * 30.47; the shipped 30 is where the panel's step-1 damping slider left it.
 * The damping ratio therefore drifts slightly off the shell's: 0.814 here vs
 * 0.826. Do not "correct" either number back onto the derivation — that would
 * be re-deriving a value Sean chose by eye. If the shell is ever retuned,
 * re-dial this on /tune rather than recomputing it, and watch the two live
 * readouts (arrival gap, minimum avatar inset) while you do: a trailing
 * avatar spills past the round trigger's 2px border.
 */
export const DEFAULT_SHARED_CLOSE_SPRING: Spring = {
  stiffness: 340,
  damping: 30,
  mass: 1,
};

/** Overdamped snap spring for the trigger's drag-end anchor snap. Not a prop. */
export const SNAP_SPRING: Spring = { stiffness: 700, damping: 52, mass: 1 };

// ── Internal choreography constants (docs/PACKAGE-DESIGN.md §3) ────────────
// Every one of these exists to suppress a specific artifact. None are props.

/** Fraction of the close progress spent holding sheetRadius before the shape
 * starts rounding toward the trigger. Prevents an over-rounded rectangle from
 * appearing before the box has actually contracted. Progress-based, not
 * time-based, so it holds correctly however long a consumer's close spring
 * runs — the wall-clock RADIUS_CLOSE_DELAY_SEC that used to sit on top of it
 * was longer than a close takes, which suppressed this hold entirely and left
 * the trigger resting on the sheet's radius (see useCollapseRadius.ts). */
export const RADIUS_HOLD_FRACTION = 0.74;

/**
 * Delay (ms) before the surface box begins its close FLIP, so the shared
 * element visibly leads the shrink instead of scaling in lockstep.
 *
 * STRAWMAN 2026-08-31, was 100 — Sean's call, one line to revert (and see
 * the warning on DEFAULT_SHARED_CLOSE_SPRING — the two are a dialled pair,
 * not a derivation, so changing this one requires re-dialling that one).
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

/** Stagger interval (s) between <MorphSheet.Item> children. */
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
