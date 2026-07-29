/**
 * anchors — the six-anchor model: nearestAnchor, restingLeft/Top, anchorCenter,
 * sheetPlacement.
 *
 * Each anchor expresses the disc's resting position as CSS edge offsets,
 * resolved against the live viewport. All functions here are pure — no DOM
 * reads, no window access beyond the values passed in — so the resting
 * position is always accurate regardless of orientation changes, window
 * resizes, or scroll behavior.
 *
 * Ported from seansmithdesign.com's anchorPositions.ts. The nav-spike helpers
 * (satelliteOffset, arcSide, bloomFromAnchor) are NOT ported — out of scope
 * for this package (see docs/PACKAGE-DESIGN.md §8). sheetPlacement below is a
 * generic replacement for bloomFromAnchor scoped to what Sheet.tsx needs:
 * left-edge px + which edge the sheet grows from.
 */

export type AnchorId =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/** Which vertical half an anchor lives in. */
export type AnchorEdge = "top" | "bottom";

/** Which horizontal third an anchor lives in. */
export type AnchorHorizontal = "left" | "center" | "right";

/** Fixed 16px inset from the viewport edge, for all six anchors. */
export const EDGE_MARGIN = 16;

/** Default anchor for a fresh session. */
export const DEFAULT_ANCHOR: AnchorId = "bottom-center";

export const ALL_ANCHORS: AnchorId[] = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

/**
 * Derive which of the 6 anchors a drag-released disc center belongs to.
 *
 * Region map (2 rows x 3 cols):
 *   Vertical split: top half vs bottom half of viewport (midline = vpH / 2).
 *   Horizontal split: left/center/right thirds (vpW / 3 boundaries).
 */
export function nearestAnchor(
  discCenterX: number,
  discCenterY: number,
  vpW: number,
  vpH: number,
): AnchorId {
  const isBottom = discCenterY >= vpH / 2;
  const row: AnchorEdge = isBottom ? "bottom" : "top";

  const third = vpW / 3;
  let col: AnchorHorizontal;
  if (discCenterX < third) {
    col = "left";
  } else if (discCenterX < third * 2) {
    col = "center";
  } else {
    col = "right";
  }

  return `${row}-${col}` as AnchorId;
}

/**
 * Left edge (viewport px) of the disc at its resting position for the given
 * anchor.
 *   Corner anchors: left = EDGE_MARGIN | right = vpW - discSize - EDGE_MARGIN
 *   Center anchors: left = vpW/2 - discSize/2
 */
export function restingLeft(
  anchor: AnchorId,
  vpW: number,
  discSize: number,
): number {
  if (anchor.endsWith("left")) return EDGE_MARGIN;
  if (anchor.endsWith("right")) return vpW - discSize - EDGE_MARGIN;
  return vpW / 2 - discSize / 2;
}

/**
 * Top edge (viewport px) of the disc at its resting position for the given
 * anchor.
 *   Top anchors: top = EDGE_MARGIN
 *   Bottom anchors: top = vpH - discSize - EDGE_MARGIN
 */
export function restingTop(
  anchor: AnchorId,
  vpH: number,
  discSize: number,
): number {
  if (anchor.startsWith("top")) return EDGE_MARGIN;
  return vpH - discSize - EDGE_MARGIN;
}

/**
 * Disc center position (viewport px) for a given anchor.
 */
export function anchorCenter(
  anchor: AnchorId,
  vpW: number,
  vpH: number,
  discSize: number,
): { x: number; y: number } {
  const half = discSize / 2;
  const M = EDGE_MARGIN;

  const isTop = anchor.startsWith("top");
  const cy = isTop ? M + half : vpH - M - half;

  let cx: number;
  if (anchor.endsWith("left")) {
    cx = M + half;
  } else if (anchor.endsWith("right")) {
    cx = vpW - M - half;
  } else {
    cx = vpW / 2;
  }

  return { x: cx, y: cy };
}

/** Resolved sheet placement derived from an AnchorId. */
export interface SheetPlacement {
  /** Which viewport edge the sheet grows from. */
  anchorEdge: AnchorEdge;
  /** Sheet's left edge in viewport px. */
  anchorX: number;
  /** Sheet's top edge in viewport px. Only defined when anchorEdge is "top". */
  anchorTopPx: number | undefined;
}

/**
 * sheetPlacement — derive the sheet's growth edge + horizontal position from
 * an AnchorId, clamped so the full sheet stays on-screen.
 *
 *   top-*    anchors -> sheet grows DOWNWARD (anchorEdge = "top")
 *   bottom-* anchors -> sheet grows UPWARD   (anchorEdge = "bottom")
 */
export function sheetPlacement(
  anchor: AnchorId,
  vpW: number,
  vpH: number,
  discSize: number,
  sheetMaxWidth: number,
): SheetPlacement {
  const SHEET_MARGIN = 16;
  const center = anchorCenter(anchor, vpW, vpH, discSize);
  const sheetHalfWidth = Math.min(sheetMaxWidth, vpW - 32) / 2;

  const clampedSheetCenterX = Math.min(
    Math.max(center.x, sheetHalfWidth + SHEET_MARGIN),
    vpW - sheetHalfWidth - SHEET_MARGIN,
  );
  const clampedAnchorX = Math.max(
    SHEET_MARGIN,
    clampedSheetCenterX - sheetHalfWidth,
  );

  const anchorEdge: AnchorEdge = anchor.startsWith("top") ? "top" : "bottom";

  const anchorTopPx =
    anchorEdge === "top" ? Math.max(SHEET_MARGIN, EDGE_MARGIN) : undefined;

  return { anchorEdge, anchorX: clampedAnchorX, anchorTopPx };
}
