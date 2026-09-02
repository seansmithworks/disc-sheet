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
  resolveMotion,
} from "./motion";
import type { SharedTransitionByDirection, StiffnessSpring } from "./types";

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

  it("is deep-frozen: mutating a clone's transition does not poison the shared constants (F6)", () => {
    const clone = { ...presets.default };
    expect(() => {
      // @ts-expect-error — intentionally mutating a frozen object to prove it throws
      clone.transition.open.stiffness = 1;
    }).toThrow();
    expect((DEFAULT_OPEN_SPRING as StiffnessSpring).stiffness).toBe(375);
    expect(presets.default.transition?.open).toBe(DEFAULT_OPEN_SPRING);
  });
});

describe("resolveMotion — preset / explicit-prop precedence (per-field, not whole-object)", () => {
  // resolveMotion (motion.ts) is the ACTUAL function Root.tsx calls — these
  // tests exercise that function directly, not a re-declared copy of its
  // expression, so a regression in the real merge fails them (F3).
  it("preset-only: every field comes from the preset", () => {
    const preset = presets.snappy;
    const result = resolveMotion({
      preset,
      transition: undefined,
      surfaceCloseLeadDelayMs: preset.surfaceCloseLeadDelayMs!,
      reduceMotion: false,
      open: true,
    });
    expect(result.open).toMatchObject(preset.transition!.open!);
    const resultClose = resolveMotion({
      preset,
      transition: undefined,
      surfaceCloseLeadDelayMs: preset.surfaceCloseLeadDelayMs!,
      reduceMotion: false,
      open: false,
    });
    expect(resultClose.close).toMatchObject(preset.transition!.close!);
  });

  it("explicit-only (no preset): fields come from the explicit transition", () => {
    const explicitOpen = { stiffness: 999, damping: 10 };
    const result = resolveMotion({
      preset: undefined,
      transition: { open: explicitOpen },
      surfaceCloseLeadDelayMs: SURFACE_CLOSE_LEAD_DELAY_MS,
      reduceMotion: false,
      open: true,
    });
    expect(result.open).toMatchObject(explicitOpen);
    // no explicit close, no preset: falls all the way to the package default
    const resultClose = resolveMotion({
      preset: undefined,
      transition: { open: explicitOpen },
      surfaceCloseLeadDelayMs: SURFACE_CLOSE_LEAD_DELAY_MS,
      reduceMotion: false,
      open: false,
    });
    expect(resultClose.close).toMatchObject(DEFAULT_CLOSE_SPRING);
  });

  it("mixed: an explicit field wins over the same preset field, others fall through to the preset", () => {
    const preset = presets.snappy;
    const explicitOpen = { stiffness: 999, damping: 10 };
    const result = resolveMotion({
      preset,
      transition: { open: explicitOpen },
      surfaceCloseLeadDelayMs: preset.surfaceCloseLeadDelayMs!,
      reduceMotion: false,
      open: true,
    });
    expect(result.open).toMatchObject(explicitOpen); // caller wins
    const resultClose = resolveMotion({
      preset,
      transition: { open: explicitOpen },
      surfaceCloseLeadDelayMs: preset.surfaceCloseLeadDelayMs!,
      reduceMotion: false,
      open: false,
    });
    // falls through to the preset's close, NOT the package default
    expect(resultClose.close).toMatchObject(preset.transition!.close!);
    expect(resultClose.close).not.toMatchObject(DEFAULT_CLOSE_SPRING);
  });

  it("F2: a partial directional `shared` override falls back per-direction to the PRESET's shared, not the package default", () => {
    const preset = presets.snappy;
    const presetSharedClose = (
      preset.transition!.shared as SharedTransitionByDirection
    ).close;
    const result = resolveMotion({
      preset,
      transition: { shared: { open: { stiffness: 1, damping: 1 } } },
      surfaceCloseLeadDelayMs: preset.surfaceCloseLeadDelayMs!,
      reduceMotion: false,
      open: false, // close direction — not specified explicitly
    });
    expect(result.shared).toMatchObject(presetSharedClose as object);
    expect(result.shared).not.toMatchObject(DEFAULT_SHARED_CLOSE_SPRING);
  });

  it("shared: an explicit directional object wins outright over a preset's directional object for the direction it specifies", () => {
    const preset = presets.snappy;
    const explicitShared: SharedTransitionByDirection = {
      open: { stiffness: 1, damping: 1 },
    };
    const result = resolveMotion({
      preset,
      transition: { shared: explicitShared },
      surfaceCloseLeadDelayMs: preset.surfaceCloseLeadDelayMs!,
      reduceMotion: false,
      open: true,
    });
    expect(result.shared).toMatchObject(explicitShared.open!);
  });

  it("no preset, no explicit transition: every field is the package default", () => {
    const result = resolveMotion({
      preset: undefined,
      transition: undefined,
      surfaceCloseLeadDelayMs: SURFACE_CLOSE_LEAD_DELAY_MS,
      reduceMotion: false,
      open: true,
    });
    expect(result.open).toMatchObject(DEFAULT_OPEN_SPRING);
    expect(result.shared).toMatchObject(DEFAULT_SHARED_SPRING);
  });

  it("reduced motion: close transition carries no lead delay", () => {
    const withDelay = resolveMotion({
      preset: undefined,
      transition: undefined,
      surfaceCloseLeadDelayMs: SURFACE_CLOSE_LEAD_DELAY_MS,
      reduceMotion: false,
      open: false,
    });
    expect(withDelay.close).toMatchObject({
      delay: SURFACE_CLOSE_LEAD_DELAY_MS / 1000,
    });
    const reduced = resolveMotion({
      preset: undefined,
      transition: undefined,
      surfaceCloseLeadDelayMs: SURFACE_CLOSE_LEAD_DELAY_MS,
      reduceMotion: true,
      open: false,
    });
    expect(reduced.close).not.toHaveProperty("delay");
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
