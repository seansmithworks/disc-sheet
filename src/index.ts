import { Root } from "./Root";
import { Disc } from "./Disc";
import { Sheet } from "./Sheet";
import { Shared } from "./Shared";
import { Content } from "./Content";
import { Item } from "./Item";
import { Close } from "./Close";
import { Shadow } from "./Shadow";

/**
 * DiscSheet — draggable disc that morphs into a modal sheet.
 *
 * ```tsx
 * <DiscSheet.Root>
 *   <DiscSheet.Shadow />
 *   <DiscSheet.Disc aria-label="Open contact">
 *     <DiscSheet.Shared><Avatar /></DiscSheet.Shared>
 *   </DiscSheet.Disc>
 *   <DiscSheet.Sheet aria-labelledby="sheet-title">
 *     <DiscSheet.Shared><Avatar /></DiscSheet.Shared>
 *     <DiscSheet.Content>
 *       <DiscSheet.Close aria-label="Close" />
 *       <DiscSheet.Item><h2 id="sheet-title">Title</h2></DiscSheet.Item>
 *     </DiscSheet.Content>
 *   </DiscSheet.Sheet>
 * </DiscSheet.Root>
 * ```
 */
export const DiscSheet = {
  Root,
  Disc,
  Sheet,
  Shared,
  Content,
  Item,
  Close,
  Shadow,
};

export { useDiscSheet } from "./context";

export type {
  AnchorId,
  CloseProps,
  ContentProps,
  DiscProps,
  DiscSheetState,
  ItemProps,
  Labelled,
  MorphTransition,
  Rect,
  RootProps,
  SharedProps,
  SheetProps,
  SheetRect,
  ShadowProps,
  Spring,
} from "./types";

export {
  anchorCenter,
  nearestAnchor,
  restingLeft,
  restingTop,
  sheetPlacement,
} from "./anchors";
export type { AnchorEdge, AnchorHorizontal, SheetPlacement } from "./anchors";
