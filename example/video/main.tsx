import { createRoot } from "react-dom/client";
import { VistaSheet, type TriggerShape } from "../../src/index";
import { ALL_ANCHORS, DEFAULT_ANCHOR, type AnchorId } from "../../src/anchors";
import "./video.css";

const CLIP = "/media/vista-sheet-portrait.mp4";
const POSTER = "/media/vista-sheet-portrait.jpg";

// Strawman (v0.2): tall/wide/narrow = 9:16, 16:9, 1:2 — test vocabulary for
// media.spec.ts, not part of the public API.
const SHEET_RATIOS: Record<string, number> = {
  tall: 9 / 16,
  wide: 16 / 9,
  narrow: 1 / 2,
};

const params = new URLSearchParams(window.location.search);

const ratioParam = params.get("ratio");
const ratio = ratioParam && ratioParam in SHEET_RATIOS ? ratioParam : "tall";

const anchorParam = params.get("anchor");
const anchor: AnchorId = (ALL_ANCHORS as readonly string[]).includes(
  anchorParam ?? "",
)
  ? (anchorParam as AnchorId)
  : DEFAULT_ANCHOR;

const SHAPE_PARAM_VALUES: readonly TriggerShape[] = [
  "circle",
  "squircle",
  "rounded-square",
  "square",
];
const shapeParam = params.get("shape");
const shape: TriggerShape =
  SHAPE_PARAM_VALUES.find((s) => s === shapeParam) ?? "circle";

const withMedia = params.get("media") !== "0";

function App() {
  return (
    <VistaSheet.Root
      id="video"
      className="video-theme"
      defaultAnchor={anchor}
      persistKey={false}
      shape={shape}
    >
      <VistaSheet.Shadow />

      <VistaSheet.Trigger aria-label="Open portrait video">
        {withMedia && (
          <VistaSheet.Media src={CLIP} poster={POSTER} aspectRatio={9 / 16} />
        )}
      </VistaSheet.Trigger>

      <VistaSheet.Sheet
        aria-label="Portrait video"
        aspectRatio={SHEET_RATIOS[ratio]}
      >
        {withMedia ? (
          <VistaSheet.Media src={CLIP} poster={POSTER} aspectRatio={9 / 16} />
        ) : (
          <div className="video-fixture-fill" />
        )}
        <VistaSheet.Close aria-label="Close" />
      </VistaSheet.Sheet>
    </VistaSheet.Root>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
