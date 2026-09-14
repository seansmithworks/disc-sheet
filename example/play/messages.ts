import type { AnchorId } from "../../src/index";
import type { PlayState } from "./state";

export type PlayMessage =
  | { type: "vista-sheet-play:ready" }
  | { type: "vista-sheet-play:state"; state: PlayState }
  // A drag report: the stage tells the shell where the specimen landed.
  | { type: "vista-sheet-play:anchor"; anchor: AnchorId }
  // A command: the shell tells the stage to move the specimen (Anchor
  // dropdown only). Never sent in response to a report — that round trip
  // is what looped forever before this type existed.
  | { type: "vista-sheet-play:set-anchor"; anchor: AnchorId };

export function isPlayMessage(data: unknown): data is PlayMessage {
  if (typeof data !== "object" || data === null) return false;
  const type = (data as { type?: unknown }).type;
  return (
    type === "vista-sheet-play:ready" ||
    type === "vista-sheet-play:state" ||
    type === "vista-sheet-play:anchor" ||
    type === "vista-sheet-play:set-anchor"
  );
}
