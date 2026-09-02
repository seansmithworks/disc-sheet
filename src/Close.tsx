"use client";

import { useEffect } from "react";
import { useMorphSheetInternal } from "./context";
import type { CloseProps } from "./types";
import styles from "./styles.module.css";

function DefaultCloseGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 3l10 10M13 3L3 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * <MorphSheet.Close> — the close button. Registers itself in context on
 * mount so Root/Sheet can dev-warn if the sheet opens with no visible close
 * control rendered (docs/PACKAGE-DESIGN.md §1). Escape and backdrop click are
 * not a substitute.
 */
export function Close({ children, className, ...aria }: CloseProps) {
  const ctx = useMorphSheetInternal("Close");
  const { registerClose, setOpen } = ctx;

  useEffect(() => registerClose(), [registerClose]);

  return (
    <button
      type="button"
      className={`${styles.closeButton} ${className ?? ""}`}
      data-morph-sheet-part="close"
      onClick={() => setOpen(false)}
      {...aria}
    >
      {children ?? <DefaultCloseGlyph />}
    </button>
  );
}
