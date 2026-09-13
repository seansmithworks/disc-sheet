import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ALL_ANCHORS,
  EDGE_MARGIN,
  type AnchorId,
  anchorCenter,
  nearestAnchor,
  restingLeft,
  restingTop,
  sheetPlacement,
} from "./anchors";

describe("nearestAnchor", () => {
  // Changed from the pre-center suite: (720, 450) in a 1440x900 viewport is
  // the exact viewport center, and the center column now splits into thirds
  // (top-center / center / bottom-center) rather than halves, so the exact
  // midline falls in the middle third — "center" — not "bottom-center".
  // This is intentional: it is the acceptance behavior for the center
  // anchor (AC2), not a regression in the six-anchor pins below, which are
  // asserted separately against hard-coded numbers.
  it("maps the exact center to center (the new middle-third region)", () => {
    expect(nearestAnchor(720, 450, 1440, 900)).toBe("center");
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

  // (50, vpH/2) sits in the LEFT column, which still splits into halves
  // (top vs bottom) rather than thirds — there is no middle-left anchor, so
  // the exact vertical midline in a side column must still resolve to one
  // of the two anchors that column actually has.
  it("maps the vertical midline in a side column to bottom (no middle-left)", () => {
    expect(nearestAnchor(50, 450, 1440, 900)).toBe("bottom-left");
  });

  it("resolves column boundaries at exact thirds (left-inclusive)", () => {
    const third = 1440 / 3;
    expect(nearestAnchor(third - 1, 50, 1440, 900)).toBe("top-left");
    expect(nearestAnchor(third, 50, 1440, 900)).toBe("top-center");
    expect(nearestAnchor(third * 2, 50, 1440, 900)).toBe("top-right");
  });

  it("resolves the center column's row boundaries at exact thirds (top-inclusive)", () => {
    const vpH = 900;
    const rowThird = vpH / 3;
    // x=720 stays in the center column throughout.
    expect(nearestAnchor(720, rowThird - 1, 1440, vpH)).toBe("top-center");
    expect(nearestAnchor(720, rowThird, 1440, vpH)).toBe("center");
    expect(nearestAnchor(720, rowThird * 2 - 1, 1440, vpH)).toBe("center");
    expect(nearestAnchor(720, rowThird * 2, 1440, vpH)).toBe("bottom-center");
  });

  it("center's snap zone is the middle ninth of the viewport", () => {
    const vpW = 1440;
    const vpH = 900;
    // Middle of the middle third on both axes.
    expect(nearestAnchor(vpW / 2, vpH / 2, vpW, vpH)).toBe("center");
    // Just inside each edge of the middle-ninth box.
    expect(nearestAnchor(vpW / 3 + 1, vpH / 3 + 1, vpW, vpH)).toBe("center");
    expect(nearestAnchor((vpW * 2) / 3 - 1, (vpH * 2) / 3 - 1, vpW, vpH)).toBe(
      "center",
    );
  });

  it("returns a valid anchor id for out-of-range input", () => {
    expect(ALL_ANCHORS).toContain(nearestAnchor(-500, -500, 1440, 900));
    expect(ALL_ANCHORS).toContain(nearestAnchor(99999, 99999, 1440, 900));
    expect(ALL_ANCHORS).toContain(nearestAnchor(NaN, NaN, 1440, 900));
  });
});

describe("restingLeft / restingTop — hard-coded pins for the six pre-existing anchors", () => {
  // Hard-coded against the OLD per-case formulas (not by calling
  // restingLeft/restingTop recursively) at three viewports, so a defect in
  // the new two-axis alignment model that happens to move one of these six
  // anchors cannot pass by construction.
  const VIEWPORTS = [
    { vpW: 375, vpH: 812 },
    { vpW: 1280, vpH: 800 },
    { vpW: 1700, vpH: 1000 },
  ];
  const triggerSize = 96;

  for (const { vpW, vpH } of VIEWPORTS) {
    const oldLeft: Record<string, number> = {
      "top-left": EDGE_MARGIN,
      "top-center": vpW / 2 - triggerSize / 2,
      "top-right": vpW - triggerSize - EDGE_MARGIN,
      "bottom-left": EDGE_MARGIN,
      "bottom-center": vpW / 2 - triggerSize / 2,
      "bottom-right": vpW - triggerSize - EDGE_MARGIN,
    };
    const oldTop: Record<string, number> = {
      "top-left": EDGE_MARGIN,
      "top-center": EDGE_MARGIN,
      "top-right": EDGE_MARGIN,
      "bottom-left": vpH - triggerSize - EDGE_MARGIN,
      "bottom-center": vpH - triggerSize - EDGE_MARGIN,
      "bottom-right": vpH - triggerSize - EDGE_MARGIN,
    };

    for (const anchor of Object.keys(oldLeft) as AnchorId[]) {
      it(`${anchor} at ${vpW}x${vpH} matches the pre-center formula exactly`, () => {
        expect(restingLeft(anchor, vpW, triggerSize)).toBe(oldLeft[anchor]);
        expect(restingTop(anchor, vpH, triggerSize)).toBe(oldTop[anchor]);
      });
    }
  }

  it("handles a narrow viewport without going negative for a left anchor", () => {
    expect(restingLeft("top-left", 320, 96)).toBe(EDGE_MARGIN);
  });
});

describe("restingLeft / restingTop — center anchor", () => {
  const VIEWPORTS = [
    { vpW: 375, vpH: 812 },
    { vpW: 1280, vpH: 800 },
    { vpW: 1700, vpH: 1000 },
  ];
  const triggerSize = 96;

  for (const { vpW, vpH } of VIEWPORTS) {
    it(`centers the trigger at ${vpW}x${vpH}`, () => {
      expect(restingLeft("center", vpW, triggerSize)).toBe(
        vpW / 2 - triggerSize / 2,
      );
      expect(restingTop("center", vpH, triggerSize)).toBe(
        vpH / 2 - triggerSize / 2,
      );
    });
  }
});

describe("anchorCenter", () => {
  it("matches restingLeft/Top + half the trigger size", () => {
    const triggerSize = 96;
    const anchor = "top-left" as const;
    const vpW = 1440;
    const vpH = 900;
    const center = anchorCenter(anchor, vpW, vpH, triggerSize);
    expect(center.x).toBe(
      restingLeft(anchor, vpW, triggerSize) + triggerSize / 2,
    );
    expect(center.y).toBe(
      restingTop(anchor, vpH, triggerSize) + triggerSize / 2,
    );
  });

  it("centers a center anchor on the viewport midpoint", () => {
    const center = anchorCenter("bottom-center", 1440, 900, 128);
    expect(center.x).toBe(720);
  });

  // Round-trip: every anchor's own resting point, fed back through
  // nearestAnchor, must map back to itself — at all 3 viewports.
  const VIEWPORTS = [
    { vpW: 375, vpH: 812 },
    { vpW: 1280, vpH: 800 },
    { vpW: 1700, vpH: 1000 },
  ];
  for (const { vpW, vpH } of VIEWPORTS) {
    for (const anchor of ALL_ANCHORS) {
      it(`${anchor}'s resting point round-trips through nearestAnchor at ${vpW}x${vpH}`, () => {
        const triggerSize = 96;
        const { x, y } = anchorCenter(anchor, vpW, vpH, triggerSize);
        expect(nearestAnchor(x, y, vpW, vpH)).toBe(anchor);
      });
    }
  }
});

describe("sheetPlacement", () => {
  it("pins only the top edge for a top anchor (grows downward)", () => {
    const placement = sheetPlacement("top-left", 1440, 900, 96, 480);
    expect(placement.topPx).toBe(16);
    expect(placement.bottomPx).toBeUndefined();
  });

  it("pins only the bottom edge for a bottom anchor (grows upward)", () => {
    const placement = sheetPlacement("bottom-right", 1440, 900, 96, 480);
    expect(placement.topPx).toBeUndefined();
    expect(placement.bottomPx).toBe(16);
  });

  it("pins BOTH edges for the center anchor", () => {
    const placement = sheetPlacement("center", 1440, 900, 96, 480);
    expect(placement.topPx).toBe(16);
    expect(placement.bottomPx).toBe(16);
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

describe("sheetPlacement — maxHeight (regression: top-pinned lost its 100dvh-32px cap when the center anchor's shared CSS rule replaced the per-anchor override)", () => {
  // Hard-coded against the d020d91 formulas: top-pinned was
  // `calc(100dvh - anchorTopPx - 16px)` with anchorTopPx always 16, i.e.
  // `calc(100dvh - 32px)`; bottom-pinned was the flat CSS default `88dvh`.
  // Center has no d020d91 precedent (introduced in f55cb3d) and keeps its
  // own `min(88dvh, calc(100dvh - 32px))` cap.
  const TOP_PINNED_MAX_HEIGHT = "calc(100dvh - 32px)";
  const BOTTOM_PINNED_MAX_HEIGHT = "88dvh";
  const CENTER_MAX_HEIGHT = "min(88dvh, calc(100dvh - 32px))";

  const cases: [AnchorId, string][] = [
    ["top-left", TOP_PINNED_MAX_HEIGHT],
    ["top-center", TOP_PINNED_MAX_HEIGHT],
    ["top-right", TOP_PINNED_MAX_HEIGHT],
    ["bottom-left", BOTTOM_PINNED_MAX_HEIGHT],
    ["bottom-center", BOTTOM_PINNED_MAX_HEIGHT],
    ["bottom-right", BOTTOM_PINNED_MAX_HEIGHT],
    ["center", CENTER_MAX_HEIGHT],
  ];

  for (const [anchor, expected] of cases) {
    it(`resolves "${anchor}" to "${expected}"`, () => {
      const placement = sheetPlacement(anchor, 1440, 900, 96, 480);
      expect(placement.maxHeight).toBe(expected);
    });
  }
});

const DEFAULT_SHEET_WIDTH_CSS =
  "min(var(--vista-sheet-sheet-max-width, 480px), calc(100vw - 32px))";
const DEFAULT_SHEET_HEIGHT_CSS = "fit-content";

describe("sheetPlacement — aspectRatio (P4)", () => {
  it("(a) bottom-center, 1280x800, trigger 128, sheetMaxWidth 480, ratio 9:16", () => {
    const placement = sheetPlacement(
      "bottom-center",
      1280,
      800,
      128,
      480,
      9 / 16,
    );
    expect(placement.width.endsWith("px")).toBe(true);
    expect(placement.height.endsWith("px")).toBe(true);
    expect(parseFloat(placement.width)).toBeCloseTo(396, 2);
    expect(parseFloat(placement.height)).toBeCloseTo(704, 2);
    expect(placement.anchorX).toBeCloseTo(442, 2);
    expect(placement.bottomPx).toBe(16);
    expect(placement.topPx).toBeUndefined();
    expect(placement.maxHeight).toBe("88dvh");
  });

  it("(b) top-left, 1280x800, trigger 128, sheetMaxWidth 480, ratio 9:16", () => {
    const placement = sheetPlacement("top-left", 1280, 800, 128, 480, 9 / 16);
    expect(placement.width.endsWith("px")).toBe(true);
    expect(placement.height.endsWith("px")).toBe(true);
    expect(parseFloat(placement.width)).toBeCloseTo(432, 2);
    expect(parseFloat(placement.height)).toBeCloseTo(768, 2);
    expect(placement.anchorX).toBeCloseTo(16, 2);
    expect(placement.topPx).toBe(16);
  });

  it("(c) center, 1280x800, trigger 128, sheetMaxWidth 480, ratio 16:9", () => {
    const placement = sheetPlacement("center", 1280, 800, 128, 480, 16 / 9);
    expect(placement.width.endsWith("px")).toBe(true);
    expect(placement.height.endsWith("px")).toBe(true);
    expect(parseFloat(placement.width)).toBeCloseTo(480, 2);
    expect(parseFloat(placement.height)).toBeCloseTo(270, 2);
    expect(placement.anchorX).toBeCloseTo(400, 2);
    expect(placement.topPx).toBe(16);
    expect(placement.bottomPx).toBe(16);
  });

  it("(d) bottom-center, 375x812, trigger 96, sheetMaxWidth 480, ratio 9:16", () => {
    const placement = sheetPlacement(
      "bottom-center",
      375,
      812,
      96,
      480,
      9 / 16,
    );
    expect(placement.width.endsWith("px")).toBe(true);
    expect(placement.height.endsWith("px")).toBe(true);
    expect(parseFloat(placement.width)).toBeCloseTo(343, 2);
    expect(parseFloat(placement.height)).toBeCloseTo(609.78, 2);
    expect(placement.anchorX).toBeCloseTo(16, 2);
  });

  it("(e) top-right, 1280x800, trigger 128, sheetMaxWidth 480, ratio 1:2", () => {
    const placement = sheetPlacement("top-right", 1280, 800, 128, 480, 1 / 2);
    expect(placement.width.endsWith("px")).toBe(true);
    expect(placement.height.endsWith("px")).toBe(true);
    expect(parseFloat(placement.width)).toBeCloseTo(384, 2);
    expect(parseFloat(placement.height)).toBeCloseTo(768, 2);
    expect(placement.anchorX).toBeCloseTo(880, 2);
  });

  it("(f) no aspectRatio, or an invalid one, falls back to the default CSS width/height strings", () => {
    const noRatio = sheetPlacement("bottom-center", 1440, 900, 96, 480);
    expect(noRatio.width).toBe(DEFAULT_SHEET_WIDTH_CSS);
    expect(noRatio.height).toBe(DEFAULT_SHEET_HEIGHT_CSS);

    for (const bad of [0, -1, NaN]) {
      const placement = sheetPlacement(
        "bottom-center",
        1440,
        900,
        96,
        480,
        bad,
      );
      expect(placement.width).toBe(DEFAULT_SHEET_WIDTH_CSS);
      expect(placement.height).toBe(DEFAULT_SHEET_HEIGHT_CSS);
    }
  });

  it("(g) matches the CSS default width/height in .sheet exactly, whitespace-normalized", () => {
    const css = readFileSync(
      new URL("./styles.module.css", import.meta.url),
      "utf8",
    );
    const block = css.match(/\n\.sheet \{([\s\S]*?)\n\}/);
    expect(
      block,
      "expected a .sheet { ... } block in styles.module.css",
    ).not.toBeNull();
    const body = (block?.[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");

    const widthMatch = body.match(/(?:^|[;\s])width:\s*([^;]+);/);
    const heightMatch = body.match(/(?:^|[;\s])height:\s*([^;]+);/);
    expect(widthMatch, "expected a width: rule in .sheet").not.toBeNull();
    expect(heightMatch, "expected a height: rule in .sheet").not.toBeNull();

    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    const placement = sheetPlacement("bottom-center", 1440, 900, 96, 480);
    expect(normalize(widthMatch![1])).toBe(normalize(placement.width));
    expect(normalize(heightMatch![1])).toBe(normalize(placement.height));
  });
});

describe("sheetPlacement without aspectRatio — pinned placement (P4 regression)", () => {
  it("anchorX at 1440x900, trigger 96, sheetMaxWidth 480", () => {
    const at = (anchor: AnchorId) =>
      sheetPlacement(anchor, 1440, 900, 96, 480).anchorX;
    expect(at("top-left")).toBe(16);
    expect(at("top-center")).toBe(480);
    expect(at("top-right")).toBe(944);
    expect(at("bottom-left")).toBe(16);
    expect(at("bottom-center")).toBe(480);
    expect(at("bottom-right")).toBe(944);
    expect(at("center")).toBe(480);
  });

  it("topPx / bottomPx / maxHeight at 1440x900, trigger 96, sheetMaxWidth 480", () => {
    for (const anchor of [
      "top-left",
      "top-center",
      "top-right",
    ] as AnchorId[]) {
      const placement = sheetPlacement(anchor, 1440, 900, 96, 480);
      expect(placement.topPx).toBe(16);
      expect(placement.bottomPx).toBeUndefined();
      expect(placement.maxHeight).toBe("calc(100dvh - 32px)");
    }
    for (const anchor of [
      "bottom-left",
      "bottom-center",
      "bottom-right",
    ] as AnchorId[]) {
      const placement = sheetPlacement(anchor, 1440, 900, 96, 480);
      expect(placement.topPx).toBeUndefined();
      expect(placement.bottomPx).toBe(16);
      expect(placement.maxHeight).toBe("88dvh");
    }
    const center = sheetPlacement("center", 1440, 900, 96, 480);
    expect(center.topPx).toBe(16);
    expect(center.bottomPx).toBe(16);
    expect(center.maxHeight).toBe("min(88dvh, calc(100dvh - 32px))");
  });

  it("anchorX is 16 for all 7 anchors on a narrow viewport (375x812)", () => {
    for (const anchor of ALL_ANCHORS) {
      expect(sheetPlacement(anchor, 375, 812, 96, 480).anchorX).toBe(16);
    }
  });
});
