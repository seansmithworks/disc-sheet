"use client";

import { motion } from "motion/react";
import { useDiscSheetInternal } from "./context";
import type { SharedProps } from "./types";
import styles from "./styles.module.css";

/**
 * <DiscSheet.Shared> — the shared-element slot. Rendered TWICE: once inside
 * <DiscSheet.Disc>, once inside <DiscSheet.Sheet>, with the same children.
 * It carries its own layoutId and its own spring (transition.shared),
 * independent of the surface morph.
 *
 * Structural rule enforced by construction: this renders as a SIBLING of the
 * disc seed surface in Disc.tsx, never nested inside it — see
 * docs/PACKAGE-DESIGN.md §1 and the nested-layoutId-inherits-parent-FLIP
 * landmine. Nesting it would make its projection inherit the surface's
 * close-morph FLIP and freeze it at the surface's transient mid-collapse box.
 */
export function Shared({ children, className }: SharedProps) {
  const ctx = useDiscSheetInternal("Shared");
  return (
    <motion.div
      layoutId={ctx.reduceMotion ? undefined : `${ctx.idBase}-shared`}
      className={`${styles.shared} ${className ?? ""}`}
      transition={ctx.transition.shared}
      data-disc-sheet-part="shared"
    >
      {children}
    </motion.div>
  );
}
