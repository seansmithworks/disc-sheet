import { useCallback, useEffect, useState } from "react";

export interface DiscSizeRamp {
  base: number;
  md?: number;
  xl?: number;
}

export const MD_BREAKPOINT = 768;
export const XL_BREAKPOINT = 1600;

/**
 * resolveDiscSize — the single source of truth for the disc's responsive
 * diameter. Root.tsx calls this at three fixed widths (0 / MD_BREAKPOINT /
 * XL_BREAKPOINT) to derive the @media rules it renders in a scoped <style>
 * (see the D3 fix note on Root.tsx) — so the ramp's breakpoints are declared
 * ONCE, here, and every consumer (the live JS value below, AND the
 * server-rendered CSS) derives from this one function. This is still the
 * fix docs/PACKAGE-DESIGN.md §2 describes ("One fix taken during
 * extraction" — the source site duplicated these breakpoints in JS and CSS
 * with a "keep in sync" comment): there is one ramp, JS reads it via this
 * function and CSS reads it via rules generated FROM this function, never a
 * hand-copied second literal.
 */
export function resolveDiscSize(
  discSize: number | DiscSizeRamp | undefined,
  vpW: number,
): number {
  if (typeof discSize === "number") return discSize;

  const ramp: DiscSizeRamp = discSize ?? { base: 96, md: 128, xl: 144 };
  if (vpW >= XL_BREAKPOINT && ramp.xl !== undefined) return ramp.xl;
  if (vpW >= MD_BREAKPOINT && ramp.md !== undefined) return ramp.md;
  return ramp.base;
}

/**
 * useDiscSize — resolves the disc's diameter from the current viewport width
 * and keeps it live across resizes. SSR-safe: returns the ramp's base value
 * (or the fixed number) until mounted.
 *
 * This live JS value now feeds ONLY position math (anchors.ts) and the
 * imperative drag-constraint numbers in Disc.tsx — never a FLIP-tracked
 * element's painted box. That box is sized by CSS alone, reading
 * --disc-sheet-disc-size, which Root.tsx sets via a server-rendered
 * @media-query <style> block (derived from resolveDiscSize above) rather
 * than an inline write of this hook's return value. That is the D3 fix:
 * the promotion window this hook still has (base value until the effect
 * below fires) no longer matters to Motion's shared-layoutId snapshot,
 * because the box it snapshots is never sized from this hook's return
 * value in the first place.
 */
export function useDiscSize(
  discSize: number | DiscSizeRamp | undefined,
): number {
  // The lazy initializer runs during the client's hydration render, not
  // before it — so reading window.innerWidth here (as the previous version
  // did) makes the server emit the ramp's base value while the client's
  // FIRST render computes the real one, and React 19 flags that as a
  // hydration mismatch. Always resolve at vpW=0 (the ramp's base / the fixed
  // number) so the client's first render matches SSR exactly; the resize
  // effect below promotes to the real size immediately after mount.
  const initial = useCallback(
    () => resolveDiscSize(discSize, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolved once at mount, then kept live by the resize effect below
    [],
  );

  const [size, setSize] = useState<number>(initial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setSize(resolveDiscSize(discSize, window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- discSize's identity (object ramp) may change per render if the consumer doesn't memoize; re-resolving is cheap and correct
  }, [
    typeof discSize === "number" ? discSize : JSON.stringify(discSize ?? {}),
  ]);

  return size;
}
