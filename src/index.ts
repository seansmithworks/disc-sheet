import { Root } from "./Root";
import { Trigger } from "./Trigger";
import { Sheet } from "./Sheet";
import { Shared } from "./Shared";
import { Content } from "./Content";
import { Item } from "./Item";
import { Close } from "./Close";
import { Shadow } from "./Shadow";

/**
 * MorphSheet — draggable trigger that morphs into a modal sheet.
 *
 * ```tsx
 * <MorphSheet.Root>
 *   <MorphSheet.Shadow />
 *   <MorphSheet.Trigger aria-label="Open contact">
 *     <MorphSheet.Shared><Avatar /></MorphSheet.Shared>
 *   </MorphSheet.Trigger>
 *   <MorphSheet.Sheet aria-labelledby="sheet-title">
 *     <MorphSheet.Shared><Avatar /></MorphSheet.Shared>
 *     <MorphSheet.Content>
 *       <MorphSheet.Close aria-label="Close" />
 *       <MorphSheet.Item><h2 id="sheet-title">Title</h2></MorphSheet.Item>
 *     </MorphSheet.Content>
 *   </MorphSheet.Sheet>
 * </MorphSheet.Root>
 * ```
 */
export const MorphSheet = {
  Root,
  Trigger,
  Sheet,
  Shared,
  Content,
  Item,
  Close,
  Shadow,
};

export { useMorphSheet } from "./context";
export { presets } from "./motion";

export type {
  AnchorId,
  CloseProps,
  ContentProps,
  TriggerProps,
  MorphSheetState,
  ItemProps,
  Labelled,
  MorphTransition,
  MotionPreset,
  Rect,
  RootProps,
  SharedProps,
  SharedTransitionByDirection,
  SheetProps,
  SheetRect,
  ShadowProps,
  Spring,
  StiffnessSpring,
  DurationSpring,
} from "./types";

export {
  anchorCenter,
  nearestAnchor,
  restingLeft,
  restingTop,
  sheetPlacement,
} from "./anchors";
export type { AnchorEdge, AnchorHorizontal, SheetPlacement } from "./anchors";
