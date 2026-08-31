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
            // serialised two ramps that should overlap: the container's own
            // 260ms fade ran to completion BEFORE the first <Item> was
            // allowed to start, and since every Item sits at opacity 0 until
            // its own turn, that container ramp was invisible — 260ms of
            // nothing on screen. Measured on both example pages: the box was
            // 99% settled at +381ms, the first item did not begin to appear
            // until +465ms, and the last landed past +697ms. A dead beat,
            // then a cascade, on a morph whose box had already stopped.
            // delayChildren holds the same guarantee that delay was there for
            // (no text painted while the box is still visibly scaling) while
            // letting the stagger run under the container's fade, so the
            // reveal finishes with the morph instead of after it.
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
