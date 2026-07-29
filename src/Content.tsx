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
            when: "beforeChildren" as const,
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
