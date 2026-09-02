import { describe, expect, it } from "vitest";
import {
  EDGE_MARGIN,
  anchorCenter,
  nearestAnchor,
  restingLeft,
  restingTop,
  sheetPlacement,
} from "./anchors";

describe("nearestAnchor", () => {
  it("maps the exact center to bottom-center (bottom-inclusive midline)", () => {
    expect(nearestAnchor(720, 450, 1440, 900)).toBe("bottom-center");
  });

  it("maps the top-left region", () => {
    expect(nearestAnchor(50, 50, 1440, 900)).toBe("top-left");
  });

  it("maps the top-right region", () => {
    expect(nearestAnchor(1400, 50, 1440, 900)).toBe("top-right");
  });

  it("maps the bottom-left region", () => {
    expect(nearestAnchor(50, 850, 1440, 900)).toBe("bottom-left");
  });

  it("maps the bottom-right region", () => {
    expect(nearestAnchor(1400, 850, 1440, 900)).toBe("bottom-right");
  });

  it("resolves column boundaries at exact thirds (left-inclusive)", () => {
    const third = 1440 / 3;
    expect(nearestAnchor(third - 1, 50, 1440, 900)).toBe("top-left");
    expect(nearestAnchor(third, 50, 1440, 900)).toBe("top-center");
    expect(nearestAnchor(third * 2, 50, 1440, 900)).toBe("top-right");
  });
});

describe("restingLeft / restingTop", () => {
  it("insets corner anchors by EDGE_MARGIN", () => {
    expect(restingLeft("top-left", 1440, 96)).toBe(EDGE_MARGIN);
    expect(restingLeft("bottom-right", 1440, 96)).toBe(1440 - 96 - EDGE_MARGIN);
    expect(restingTop("top-right", 900, 96)).toBe(EDGE_MARGIN);
    expect(restingTop("bottom-left", 900, 96)).toBe(900 - 96 - EDGE_MARGIN);
  });

  it("centers center anchors horizontally", () => {
    expect(restingLeft("top-center", 1440, 96)).toBe(1440 / 2 - 96 / 2);
    expect(restingLeft("bottom-center", 1440, 128)).toBe(1440 / 2 - 128 / 2);
  });

  it("handles a narrow viewport without going negative for a left anchor", () => {
    expect(restingLeft("top-left", 320, 96)).toBe(EDGE_MARGIN);
  });
});

describe("anchorCenter", () => {
  it("matches restingLeft/Top + half the trigger size", () => {
    const triggerSize = 96;
    const anchor = "top-left" as const;
    const vpW = 1440;
    const vpH = 900;
    const center = anchorCenter(anchor, vpW, vpH, triggerSize);
    expect(center.x).toBe(restingLeft(anchor, vpW, triggerSize) + triggerSize / 2);
    expect(center.y).toBe(restingTop(anchor, vpH, triggerSize) + triggerSize / 2);
  });

  it("centers a center anchor on the viewport midpoint", () => {
    const center = anchorCenter("bottom-center", 1440, 900, 128);
    expect(center.x).toBe(720);
  });
});

describe("sheetPlacement", () => {
  it("grows downward from a top anchor and upward from a bottom anchor", () => {
    expect(sheetPlacement("top-left", 1440, 900, 96, 480).anchorEdge).toBe(
      "top",
    );
    expect(sheetPlacement("bottom-right", 1440, 900, 96, 480).anchorEdge).toBe(
      "bottom",
    );
  });

  it("sets anchorTopPx only for top-anchored placements", () => {
    const top = sheetPlacement("top-center", 1440, 900, 96, 480);
    expect(top.anchorTopPx).toBe(16);

    const bottom = sheetPlacement("bottom-center", 1440, 900, 96, 480);
    expect(bottom.anchorTopPx).toBeUndefined();
  });

  it("clamps the sheet on-screen when the trigger sits at a viewport edge", () => {
    // Trigger pinned to the left edge; a 480px-wide sheet centered on the trigger
    // would run off-screen to the left. anchorX must stay >= SHEET_MARGIN (16).
    const placement = sheetPlacement("top-left", 1440, 900, 96, 480);
    expect(placement.anchorX).toBeGreaterThanOrEqual(16);
  });

  it("clamps the sheet on a narrow viewport where the sheet nearly fills the width", () => {
    // vpW - 32 < sheetMaxWidth, so the effective sheet width is vpW - 32,
    // half of that is the half-width used to clamp — this must not throw or
    // produce a negative anchorX.
    const placement = sheetPlacement("bottom-center", 320, 700, 96, 480);
    expect(placement.anchorX).toBeGreaterThanOrEqual(16);
    expect(Number.isFinite(placement.anchorX)).toBe(true);
  });
});
