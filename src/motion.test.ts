import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLOSE_SPRING,
  DEFAULT_OPEN_SPRING,
  DEFAULT_SHARED_CLOSE_SPRING,
  DEFAULT_SHARED_SPRING,
  SURFACE_CLOSE_LEAD_DELAY_MS,
  isSharedByDirection,
  mergeTransition,
  presets,
} from "./motion";
import type { MorphTransition, SharedTransitionByDirection } from "./types";

describe("presets.default", () => {
  it("references the shipped constants (byte-identical to no-preset, structurally)", () => {
    expect(presets.default.transition?.open).toBe(DEFAULT_OPEN_SPRING);
    expect(presets.default.transition?.close).toBe(DEFAULT_CLOSE_SPRING);
    const shared = presets.default.transition
      ?.shared as SharedTransitionByDirection;
    expect(shared.open).toBe(DEFAULT_SHARED_SPRING);
    expect(shared.close).toBe(DEFAULT_SHARED_CLOSE_SPRING);
    expect(presets.default.surfaceCloseLeadDelayMs).toBe(
      SURFACE_CLOSE_LEAD_DELAY_MS,
    );
  });
});

describe("preset / explicit-prop precedence (per-field, not whole-object)", () => {
  // Root.tsx does the actual merge (transition?.field ?? preset?.transition?.field);
  // these cases exercise that same expression directly since it has no other
  // side effects worth mounting a component for.
  it("preset-only: every field comes from the preset", () => {
    const preset = presets.snappy;
    const transition = undefined as MorphTransition | undefined;
    const open = transition?.open ?? preset.transition?.open;
    const close = transition?.close ?? preset.transition?.close;
    const shared = transition?.shared ?? preset.transition?.shared;
    expect(open).toBe(preset.transition?.open);
    expect(close).toBe(preset.transition?.close);
    expect(shared).toBe(preset.transition?.shared);
  });

  it("explicit-only (no preset): fields come from the explicit transition", () => {
    const preset = undefined as (typeof presets)["snappy"] | undefined;
    const transition: MorphTransition = {
      open: { stiffness: 999, damping: 10 },
    };
    const open = transition.open ?? preset?.transition?.open;
    const close = transition.close ?? preset?.transition?.close;
    expect(open).toBe(transition.open);
    expect(close).toBeUndefined();
  });

  it("mixed: an explicit field wins over the same preset field, others fall through", () => {
    const preset = presets.snappy;
    const explicitOpen = { stiffness: 999, damping: 10 };
    const transition: MorphTransition = { open: explicitOpen };

    const open = transition.open ?? preset.transition?.open;
    const close = transition.close ?? preset.transition?.close;
    const shared = transition.shared ?? preset.transition?.shared;

    expect(open).toBe(explicitOpen); // caller wins
    expect(close).toBe(preset.transition?.close); // falls through to preset
    expect(shared).toBe(preset.transition?.shared); // falls through to preset
  });

  it("shared: an explicit directional object wins outright over a preset's directional object, no deep merge", () => {
    const preset = presets.snappy; // shared is a {open, close} directional object
    const explicitShared: SharedTransitionByDirection = {
      open: { stiffness: 1, damping: 1 },
    };
    const shared = explicitShared ?? preset.transition?.shared;
    expect(shared).toBe(explicitShared);
    // and NOT a merge of explicitShared.open with preset's shared.close
    expect(shared.close).toBeUndefined();
  });
});

describe("mergeTransition — {visualDuration, bounce} shorthand", () => {
  const fallback = { stiffness: 100, damping: 10 };

  it("resolves to a spring, preserving both keys", () => {
    const result = mergeTransition(
      { visualDuration: 0.4, bounce: 0.2 },
      fallback,
    );
    expect(result).toMatchObject({
      type: "spring",
      visualDuration: 0.4,
      bounce: 0.2,
    });
  });

  it("does not break the tween path: {duration} stays a tween, not a spring", () => {
    const result = mergeTransition({ duration: 0.3 }, fallback);
    expect(result).not.toHaveProperty("type", "spring");
    expect(result).toMatchObject({ duration: 0.3 });
  });

  it("isSharedByDirection still rejects the shorthand (no open/close keys)", () => {
    expect(isSharedByDirection({ visualDuration: 0.4, bounce: 0.2 })).toBe(
      false,
    );
  });
});
