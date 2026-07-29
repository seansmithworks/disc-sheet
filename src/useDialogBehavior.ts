import { useEffect } from "react";
import type { RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * useDialogBehavior — scroll lock, focus trap, Escape, and focus restore on
 * exit-complete (docs/PACKAGE-DESIGN.md §6).
 *
 * Escape is unconditional and not configurable: a modal surface that traps
 * focus and cannot be dismissed by keyboard is a defect, not a variant.
 *
 * Focus lands on the dialog panel itself on open (not the first control) so
 * opening the sheet never pre-highlights a link. Focus restore to the
 * trigger happens on `onExitComplete`, called by <DiscSheet.Sheet>'s
 * AnimatePresence — not at the moment `open` flips false — so the restore
 * doesn't cause a visible scroll jump mid-close.
 */
export function useDialogBehavior({
  isOpen,
  panelRef,
  onClose,
}: {
  isOpen: boolean;
  panelRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}): void {
  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(id);
  }, [isOpen, panelRef]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const items = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, panelRef]);
}
