import type { AnchorId } from "../../src/index";
import type { PlayState } from "./state";

export type PlayMessage =
  | { type: "vista-sheet-play:ready" }
  | { type: "vista-sheet-play:state"; state: PlayState }
  | { type: "vista-sheet-play:anchor"; anchor: AnchorId };

export function isPlayMessage(data: unknown): data is PlayMessage {
  if (typeof data !== "object" || data === null) return false;
  const type = (data as { type?: unknown }).type;
  return (
    type === "vista-sheet-play:ready" ||
    type === "vista-sheet-play:state" ||
    type === "vista-sheet-play:anchor"
  );
}
