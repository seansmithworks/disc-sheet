import { useCallback, useEffect, useState } from "react";

export interface DiscSizeRamp {
  base: number;
  md?: number;
  xl?: number;
}

const MD_BREAKPOINT = 768;
const XL_BREAKPOINT = 1600;

/**
 * resolveDiscSize — the single source of truth for the disc's responsive
 * diameter. JS resolves the size; the CSS module only ever reads the
 * resulting --disc-sheet-disc-size custom property (see
 * docs/PACKAGE-DESIGN.md §2, "One fix taken during extraction" — the source
 * site duplicated these breakpoints in JS and CSS with a "keep in sync"
 * comment; that duplication is not carried over here).
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
 */
export function useDiscSize(
  discSize: number | DiscSizeRamp | undefined,
): number {
  const initial = useCallback(
    () =>
      resolveDiscSize(
        discSize,
        typeof window === "undefined" ? 0 : window.innerWidth,
      ),
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
