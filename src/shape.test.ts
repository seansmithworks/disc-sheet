// prettier-ignore
import { TRIGGER_SHAPES, DEFAULT_TRIGGER_SHAPE, ROUNDED_SQUARE_RADIUS_FRACTION, SQUIRCLE_FALLBACK_RADIUS_FRACTION, supportsCornerShape, resolveTriggerCornerRadius, initialTriggerRestRadius, collapseRadiusAt } from "./shape";
import { describe, expect, it } from "vitest";
import { RADIUS_HOLD_FRACTION } from "./motion";

/**
 * P2 task 1 — failing tests for src/shape.ts, which task 2 creates. The
 * `@ts-expect-error` directive above keeps `npx tsc --noEmit` at the
 * repo's 6-error baseline until then; delete it in the same commit that
 * lands src/shape.ts.
 */
describe("shape constants", () => {
  it("TRIGGER_SHAPES lists all four shapes in order", () => {
    expect(TRIGGER_SHAPES).toEqual([
      "circle",
      "squircle",
      "rounded-square",
      "square",
    ]);
  });

  it("DEFAULT_TRIGGER_SHAPE is circle", () => {
    expect(DEFAULT_TRIGGER_SHAPE).toBe("circle");
  });

  it("ROUNDED_SQUARE_RADIUS_FRACTION is 0.25", () => {
    expect(ROUNDED_SQUARE_RADIUS_FRACTION).toBe(0.25);
  });

  it("SQUIRCLE_FALLBACK_RADIUS_FRACTION matches the n=4 superellipse's 45deg extent", () => {
    expect(SQUIRCLE_FALLBACK_RADIUS_FRACTION).toBeCloseTo(
      (1 - 2 ** -0.25) / (2 * (1 - 2 ** -0.5)),
      4,
    );
  });
});

describe("resolveTriggerCornerRadius", () => {
  it("circle: min(token, size/2) — today's behaviour, token defaults to 9999", () => {
    expect(
      resolveTriggerCornerRadius({ shape: "circle", triggerSize: 96 }),
    ).toBe(48);
    expect(
      resolveTriggerCornerRadius({ shape: "circle", triggerSize: 128 }),
    ).toBe(64);
    expect(
      resolveTriggerCornerRadius({ shape: "circle", triggerSize: 144 }),
    ).toBe(72);
  });

  it("circle honours a smaller explicit token", () => {
    expect(
      resolveTriggerCornerRadius({
        shape: "circle",
        triggerSize: 128,
        token: 24,
      }),
    ).toBe(24);
  });

  it("squircle: half the trigger size when corner-shape is supported", () => {
    expect(
      resolveTriggerCornerRadius({
        shape: "squircle",
        triggerSize: 128,
        cornerShapeSupported: true,
      }),
    ).toBe(64);
  });

  it("squircle: SQUIRCLE_FALLBACK_RADIUS_FRACTION of the trigger size when unsupported", () => {
    expect(
      resolveTriggerCornerRadius({
        shape: "squircle",
        triggerSize: 128,
        cornerShapeSupported: false,
      }),
    ).toBeCloseTo(128 * 0.2716, 3);
  });

  it("rounded-square: ROUNDED_SQUARE_RADIUS_FRACTION of the trigger size", () => {
    expect(
      resolveTriggerCornerRadius({ shape: "rounded-square", triggerSize: 96 }),
    ).toBe(24);
    expect(
      resolveTriggerCornerRadius({ shape: "rounded-square", triggerSize: 128 }),
    ).toBe(32);
    expect(
      resolveTriggerCornerRadius({ shape: "rounded-square", triggerSize: 144 }),
    ).toBe(36);
  });

  it("rounded-square honours an explicit token", () => {
    expect(
      resolveTriggerCornerRadius({
        shape: "rounded-square",
        triggerSize: 128,
        token: 20,
      }),
    ).toBe(20);
  });

  it("square: always 0, regardless of token", () => {
    expect(
      resolveTriggerCornerRadius({ shape: "square", triggerSize: 128 }),
    ).toBe(0);
    expect(
      resolveTriggerCornerRadius({
        shape: "square",
        triggerSize: 128,
        token: 24,
      }),
    ).toBe(0);
  });
});

describe("initialTriggerRestRadius", () => {
  it("circle seeds 9999 (Chromium's exact circle, Safari's stand-in until promotion)", () => {
    expect(initialTriggerRestRadius("circle", 128)).toBe(9999);
  });

  it("squircle seeds 9999 (first-paint fallback until corner-shape support is measured)", () => {
    expect(initialTriggerRestRadius("squircle", 128)).toBe(9999);
  });

  it("rounded-square seeds from the pre-promotion trigger size", () => {
    expect(initialTriggerRestRadius("rounded-square", 128)).toBe(32);
  });

  it("square seeds 0", () => {
    expect(initialTriggerRestRadius("square", 128)).toBe(0);
  });
});

describe("supportsCornerShape", () => {
  it("is false under node (no CSS.supports)", () => {
    expect(supportsCornerShape()).toBe(false);
  });
});

describe("collapseRadiusAt", () => {
  it("holds at sheetRadius before RADIUS_HOLD_FRACTION", () => {
    expect(collapseRadiusAt(0, 32, 64)).toBe(32);
    expect(collapseRadiusAt(RADIUS_HOLD_FRACTION, 32, 0)).toBe(32);
  });

  it("reaches the trigger corner radius exactly at p=1", () => {
    expect(collapseRadiusAt(1, 32, 0)).toBe(0);
    expect(collapseRadiusAt(1, 32, 64)).toBe(64);
  });

  it("interpolates linearly through the un-held span", () => {
    expect(
      collapseRadiusAt((RADIUS_HOLD_FRACTION + 1) / 2, 32, 64),
    ).toBeCloseTo(48);
  });

  it("clamps p above 1 to the trigger corner radius", () => {
    expect(collapseRadiusAt(1.02, 32, 64)).toBe(64);
  });

  it("clamps p below 0 to sheetRadius", () => {
    expect(collapseRadiusAt(-0.01, 32, 64)).toBe(32);
  });
});
