import { useEffect } from "react";
// Relative import: the example lives inside the package repo itself (no
// publish step yet), so it reaches the package the same way main.tsx does.
// A real consumer would import from "@seansmith/disc-sheet".
import { useDiscSheet } from "../src/index";

/**
 * CloseMask — the trailing-paper close mask, rebuilt from OUTSIDE the
 * package (docs/PACKAGE-DESIGN.md §8). Ported from the source site's
 * ContactSheet.tsx:721-755 (`surfaceCloseMask`), which exists to fix one
 * artifact specific to a tall sheet whose shared element leads the close:
 * mid-collapse, the vacated paper above the avatar sits as a solid opaque
 * block for a few frames. This is the package's own escape-hatch validation
 * test — it is cut from `disc-sheet` because it does not belong in a generic
 * primitive (a sheet with no leading shared element has no such artifact),
 * but re-derived here for the flagship-style example so the demo isn't
 * visibly worse without it.
 *
 * THE FINDING: this component is buildable using ONLY the documented v0.1
 * API — useDiscSheet().collapseProgress, plus that MotionValue's own
 * built-in `getVelocity()` (a real `motion` API, not a package addition) —
 * and one documented DOM contract: the sheet element carries
 * `data-disc-sheet-part="sheet"`. No widening of useDiscSheet() was needed.
 *
 * Why getVelocity() is required: collapseProgress sweeps the SAME [0, 1]
 * range on open (1 -> 0) as on close (0 -> 1) — the fade envelope below must
 * apply ONLY during a close, or the open bloom gets masked too (a visible
 * quality loss, the exact bug the source's `closingActive` gate exists to
 * prevent). Reading the MotionValue's sign of velocity — positive while
 * progress is increasing toward 1 — is how you tell "closing" from "opening"
 * without the package exposing a second flag. At rest, velocity is 0, which
 * correctly falls through to "no fade" (solid) on both ends.
 *
 * Renders no DOM of its own: it writes `maskImage` directly onto the live
 * sheet element on every collapseProgress tick.
 */
export function CloseMask() {
  const { collapseProgress } = useDiscSheet();

  useEffect(() => {
    const apply = () => {
      const sheetEl = document.querySelector<HTMLElement>(
        '[data-disc-sheet-part="sheet"]',
      );
      if (!sheetEl) return;

      const p = collapseProgress.get();
      const velocity = collapseProgress.getVelocity();
      const closing = velocity > 0;

      if (!closing) {
        // No fade at rest or during an open: clear the property rather than
        // paint a "0% -> 100% solid" gradient. An identity mask is still a
        // mask — it forces compositing and creates a new containing block on
        // an element that also runs a FLIP, for zero visual benefit (E3).
        sheetEl.style.removeProperty("mask-image");
        sheetEl.style.removeProperty("-webkit-mask-image");
        return;
      }

      // Envelope window over collapseProgress (0 open -> 1 closed) — the
      // exact constants from ContactSheet.tsx:731-735.
      const FADE_START = 0.06;
      const FADE_PEAK = 0.5;
      const FADE_END = 0.82;
      const MAX_FADE = 0.62;
      const BAND = 18;

      let e = 0;
      if (p > FADE_START && p < FADE_END) {
        e =
          p <= FADE_PEAK
            ? (p - FADE_START) / (FADE_PEAK - FADE_START)
            : (FADE_END - p) / (FADE_END - FADE_PEAK);
      }
      e = e < 0 ? 0 : e > 1 ? 1 : e;

      const solidPct = 100 - MAX_FADE * 100 * e;
      const fadeEndPct = Math.min(100, solidPct + BAND);
      const mask = `linear-gradient(to top, #000 0%, #000 ${solidPct}%, transparent ${fadeEndPct}%)`;

      sheetEl.style.maskImage = mask;
      sheetEl.style.setProperty("-webkit-mask-image", mask);
    };

    apply();
    const unsubscribe = collapseProgress.on("change", apply);
    return unsubscribe;
  }, [collapseProgress]);

  return null;
}
