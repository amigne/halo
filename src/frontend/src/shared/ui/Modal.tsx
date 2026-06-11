import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

// ── Focusable selector ───────────────────────────────────────────────────────

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ── Body scroll lock (stacking-aware) ────────────────────────────────────────

let openModalCount = 0;

function lockBodyScroll() {
  if (openModalCount === 0) {
    document.body.style.overflow = "hidden";
  }
  openModalCount++;
}

function unlockBodyScroll() {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount === 0) {
    document.body.style.overflow = "";
  }
}

// ── Queries all focusable descendants inside a container ─────────────────────

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !(el as HTMLInputElement).disabled,
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface ModalProps {
  /** Whether the modal is visible. */
  open: boolean;
  /** Called when the modal should close (Escape, overlay click, ✕ button). */
  onClose: () => void;
  /** Title displayed in the header and used for `aria-labelledby`. */
  title: string;
  /** Modal body content. */
  children: ReactNode;
  /** Optional ref to the triggering element for focus restoration on close. */
  triggerRef?: RefObject<HTMLElement | null>;
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Accessible modal dialog following the WAI-ARIA dialog pattern.
 *
 * - `role="dialog"`, `aria-modal="true"`, `aria-labelledby` linked to title
 * - Closes on ✕ button, overlay click, or **Escape** key (U-055)
 * - **Focus trap**: Tab / Shift+Tab cycle within the modal (U-122)
 * - Initial focus on the first focusable element
 * - **Focus restoration** to the trigger element on close (U-122)
 * - Z-index: overlay uses `--z-overlay`, modal panel uses `--z-modal` (U-113)
 * - Respects `prefers-reduced-motion` (U-125)
 * - Body scroll is locked while the modal is open
 * - Rendered via portal at `document.body`
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  triggerRef,
}: ModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // ── Save previous focus on open ──────────────────────────────────────────

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    lockBodyScroll();

    // Focus the first focusable element (or the panel itself as fallback)
    requestAnimationFrame(() => {
      if (panelRef.current) {
        const focusable = getFocusableElements(panelRef.current);
        if (focusable.length > 0) {
          focusable[0]!.focus();
        } else {
          panelRef.current.focus();
        }
      }
    });

    return () => {
      unlockBodyScroll();
    };
  }, [open]);

  // ── Restore focus on close ────────────────────────────────────────────────

  useEffect(() => {
    if (!open && previousFocusRef.current) {
      const el = previousFocusRef.current;
      // If a specific triggerRef was provided, prefer it
      if (triggerRef?.current) {
        triggerRef.current.focus();
      } else if (typeof el.focus === "function") {
        el.focus();
      }
      previousFocusRef.current = null;
    }
  }, [open, triggerRef]);

  // ── Focus trap ────────────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      if (!panelRef.current) return;

      const focusable = getFocusableElements(panelRef.current);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey) {
        // Shift+Tab: if focus is on first element, wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if focus is on last element, wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  // ── Overlay click → close ─────────────────────────────────────────────────

  const handleOverlayClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      // Only close if the overlay itself was clicked (not the panel)
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-black/50 motion-safe:animate-[fadeIn_150ms_ease-out]"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-[var(--z-modal)] flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border border-border bg-surface shadow-lg motion-safe:animate-[scaleIn_150ms_ease-out] focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id={titleId} className="text-lg font-semibold text-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("ui.modal.close")}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors hover:bg-border focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
