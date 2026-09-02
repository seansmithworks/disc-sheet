import { useEffect } from "react";
import type { RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Sets aria-hidden="true" on every element that is a sibling of `target` at
 * every level from `target` up to (not including) `document.body`, so
 * assistive tech sees only the dialog subtree while it's open — the same
 * technique Radix, Base UI, Headless UI and Vaul use (not the `inert`
 * attribute, whose support is uneven). Returns a restore function that puts
 * back each element's PRE-EXISTING aria-hidden value (or removes the
 * attribute if there wasn't one), rather than blindly stripping it — a
 * sibling may have been legitimately aria-hidden before the dialog opened.
 */
function hideOutsideSiblings(target: Element): () => void {
  const restores: Array<() => void> = [];
  let node: Element | null = target;
  while (node && node !== document.body) {
    const parent: Element | null = node.parentElement;
    if (parent) {
      for (const sibling of Array.from(parent.children)) {
        if (sibling === node) continue;
        const prev = sibling.getAttribute("aria-hidden");
        sibling.setAttribute("aria-hidden", "true");
        restores.push(() => {
          if (prev === null) sibling.removeAttribute("aria-hidden");
          else sibling.setAttribute("aria-hidden", prev);
        });
      }
    }
    node = parent;
  }
  return () => {
    // Restore in reverse so a nested restore never fights an outer one.
    for (let i = restores.length - 1; i >= 0; i--) restores[i]();
  };
}

/**
 * useDialogBehavior — scroll lock, focus trap, background aria-hiding,
 * Escape, and focus restore on exit-complete (docs/PACKAGE-DESIGN.md §6).
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
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    // Compensate for the scrollbar the lock is about to remove, so the page
    // doesn't jump ~15px sideways underneath the morph on any desktop
    // browser with a visible (non-overlay) scrollbar. 0 on mobile / overlay
    // scrollbars, where innerWidth already equals the document's client
    // width — no padding added in that case.
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      const currentPaddingRight =
        parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [isOpen]);

  // Hide everything outside the dialog from assistive tech. aria-modal is a
  // hint browsers don't act on — a screen reader will otherwise read the
  // whole page behind the open sheet.
  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;
    const panel = panelRef.current;
    if (!panel) return;
    // Hide from the WIDGET's root, not the dialog panel node itself. The
    // panel, the disc trigger and the shadow are all siblings inside the
    // same <DiscSheet.Root> wrapper (this package never portals — see
    // docs/PACKAGE-DESIGN.md), and the trigger is contractually required to
    // keep reflecting aria-expanded/aria-controls to assistive tech while
    // the dialog is open (§6). Hiding from the panel's own siblings would
    // aria-hide the trigger along with everything else. Hiding from the
    // root wrapper's siblings hides real page content while leaving the
    // whole disc-sheet widget (trigger included) in the accessibility tree
    // — the same effective boundary Radix/Base UI get for free from their
    // portal root.
    const root = panel.closest("[data-disc-sheet-root]") ?? panel;
    return hideOutsideSiblings(root);
  }, [isOpen, panelRef]);

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
      if (e.key !== "Tab" || !panelRef.current) return;
      const panel = panelRef.current;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      // No focusable descendant: the panel itself (tabIndex=-1, focused
      // programmatically on open) is the only thing to hold focus on.
      const focusTargets = items.length > 0 ? items : [panel];
      const first = focusTargets[0];
      const last = focusTargets[focusTargets.length - 1];
      const active = document.activeElement;
      const focusIsInsidePanel =
        active instanceof Node && panel.contains(active);

      // The trap must hold from ANY starting position, not just from the
      // panel's own first/last focusable — a Tab press while focus is still
      // on the disc trigger (outside the panel, still in the page's tab
      // order) or during the initial-focus setTimeout window must be
      // redirected INTO the panel, not allowed to walk past it.
      if (!focusIsInsidePanel) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, panelRef]);
}
