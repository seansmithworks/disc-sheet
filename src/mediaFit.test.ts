import { describe, expect, it } from "vitest";
import { mediaCounterScale, mediaCoverBox } from "./mediaFit";

describe("mediaCoverBox", () => {
  it("covers a square container with a 9:16 ratio, centered", () => {
    const box = mediaCoverBox(100, 100, 9 / 16);
    expect(box.width).toBeCloseTo(100, 4);
    expect(box.height).toBeCloseTo(177.7778, 4);
    expect(box.left).toBeCloseTo(0, 4);
    expect(box.top).toBeCloseTo(-38.8889, 4);
  });

  it("covers a tall container with a 9:16 ratio, centered horizontally", () => {
    const box = mediaCoverBox(100, 400, 9 / 16);
    expect(box.width).toBeCloseTo(225, 4);
    expect(box.height).toBeCloseTo(400, 4);
    expect(box.left).toBeCloseTo(-62.5, 4);
    expect(box.top).toBeCloseTo(0, 4);
  });

  it("covers a wide container with a 9:16 ratio", () => {
    const box = mediaCoverBox(480, 270, 9 / 16);
    expect(box.width).toBeCloseTo(480, 4);
    expect(box.height).toBeCloseTo(853.3333, 4);
    expect(box.left).toBeCloseTo(0, 4);
    expect(box.top).toBeCloseTo(-291.6667, 4);
  });

  it("falls back to the container's own ratio when aspectRatio is <= 0", () => {
    const box = mediaCoverBox(100, 50, 0);
    expect(box.width).toBeCloseTo(100, 4);
    expect(box.height).toBeCloseTo(50, 4);
    expect(box.left).toBeCloseTo(0, 4);
    expect(box.top).toBeCloseTo(0, 4);
  });

  it("falls back to the container's own ratio when aspectRatio is NaN", () => {
    const box = mediaCoverBox(100, 50, NaN);
    expect(box.width).toBeCloseTo(100, 4);
    expect(box.height).toBeCloseTo(50, 4);
    expect(box.left).toBeCloseTo(0, 4);
    expect(box.top).toBeCloseTo(0, 4);
  });
});

describe("mediaCounterScale", () => {
  it("returns 1/1 when the surface hasn't scaled at all", () => {
    const scale = mediaCounterScale({
      containerWidth: 100,
      containerHeight: 100,
      aspectRatio: 9 / 16,
      surfaceScaleX: 1,
      surfaceScaleY: 1,
    });
    expect(scale.scaleX).toBeCloseTo(1, 9);
    expect(scale.scaleY).toBeCloseTo(1, 9);
  });

  // PROPERTY TEST — must not re-derive the implementation. For every
  // container/ratio/surface-scale combination, the rendered video box
  // (mediaCoverBox's box scaled by mediaCounterScale's factors, then by the
  // surface's own live scale) must: (1) keep the intrinsic ratio exactly,
  // (2) still cover the LIVE (post-surface-scale) container, and (3) be the
  // *minimal* such cover (not over-scaled past what's needed to cover).
  it("counter-scales the cover box to exactly cancel the surface's squash, at every sampled container/ratio/scale", () => {
    const containers: [number, number][] = [
      [92, 92],
      [478, 850],
      [343, 610],
      [480, 270],
    ];
    const ratios = [9 / 16, 16 / 9, 1 / 2];
    const scales: [number, number][] = [
      [1, 1],
      [0.2, 0.11],
      [0.19, 0.34],
      [3.2, 1.1],
      [1, 0.5],
    ];

    for (const [cw, ch] of containers) {
      for (const r of ratios) {
        for (const [sx, sy] of scales) {
          const box = mediaCoverBox(cw, ch, r);
          const s = mediaCounterScale({
            containerWidth: cw,
            containerHeight: ch,
            aspectRatio: r,
            surfaceScaleX: sx,
            surfaceScaleY: sy,
          });

          const vw = box.width * s.scaleX * sx;
          const vh = box.height * s.scaleY * sy;

          expect(Math.abs(vw / vh / r - 1)).toBeLessThan(1e-9);
          expect(vw).toBeGreaterThanOrEqual(cw * sx - 1e-9);
          expect(vh).toBeGreaterThanOrEqual(ch * sy - 1e-9);
          expect(Math.min(vw - cw * sx, vh - ch * sy)).toBeLessThan(1e-6);
        }
      }
    }
  });
});
