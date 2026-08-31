"use client";

import { motion } from "motion/react";
import { useDiscSheetInternal } from "./context";
import {
  CONTENT_FADE_OUT_DELAY_MS,
  CONTENT_FADE_OUT_MS,
  ITEM_STAGGER_INTERVAL_SEC,
  OPEN_CONTENT_REVEAL_DELAY_SEC,
} from "./motion";
import type { ContentProps } from "./types";
import styles from "./styles.module.css";

/**
 * <DiscSheet.Content> — holds sheet content at opacity 0 through the bloom
 * and reveals it after, then fades it out first on close. Owns the scroll
 * region: applies overflow-y:auto to itself and reports its scroll element
 * into context so Sheet's swipe-to-close handler can gate on scrollTop
 * (docs/PACKAGE-DESIGN.md §1 — this coupling is easy to lose in an
 * extraction).
 */
export function Content({ children, className }: ContentProps) {
  const ctx = useDiscSheetInternal("Content");
  const { reduceMotion, contentScrollElRef } = ctx;

  const variants = reduceMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.18 } },
        exit: { opacity: 0, transition: { duration: 0.12 } },
      }
    : {
        hidden: { opacity: 0, y: 8 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            delay: OPEN_CONTENT_REVEAL_DELAY_SEC,
            duration: 0.26,
            // delayChildren, NOT `when: "beforeChildren"`. beforeChildren
            // held every <Item> until the container's own 260ms fade had
            // finished, and an Item sits at opacity 0 until its turn — so
            // that fade was a dead beat. Measured, both example pages, two
            // opens each: box 99% settled 304-321ms, first Item 478-484ms,
            // last Item 712-795ms. With delayChildren the stagger runs under
            // the container's fade: first Item ~227ms, last 492-530ms.
            //
            // Deliberate tradeoff, not a free win: the first Item now paints
            // at ~227ms with the box at ~92% of final width and ~94% of
            // final height, still moving. This does NOT preserve "no text
            // painted while the box is visibly scaling" — it buys 262-266ms
            // off the reveal in exchange for a little paint-during-scale.
            delayChildren: OPEN_CONTENT_REVEAL_DELAY_SEC,
            staggerChildren: ITEM_STAGGER_INTERVAL_SEC,
          },
        },
        exit: {
          opacity: 0,
          y: 6,
          transition: {
            duration: CONTENT_FADE_OUT_MS / 1000,
            delay: CONTENT_FADE_OUT_DELAY_MS / 1000,
          },
        },
      };

  return (
    <motion.div
      ref={contentScrollElRef}
      className={`${styles.content} ${className ?? ""}`}
      data-disc-sheet-part="content"
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
