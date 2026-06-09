import { useTranslation } from "react-i18next";
import { Spinner } from "@/shared/ui/Spinner";
import type { SaveStatus } from "./use-autosave-field";

// ── Props ──────────────────────────────────────────────────────────────────────

export interface SaveIndicatorProps {
  /** Current save status. */
  status: SaveStatus;
  /** Error message (shown only when status is `"error"`). */
  error?: string | null;
  /** Called when the user clicks the retry button (error state). */
  onRetry?: () => void;
  /** Extra CSS classes. */
  className?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Discrete save-status indicator with ARIA-live announcements (U-064, U-126).
 *
 * - `idle` → nothing rendered (no noise)
 * - `saving` → spinner + "Saving…" (ARIA-live `polite`)
 * - `saved` → checkmark + "Saved" (ARIA-live `polite`, auto-fades)
 * - `error` → warning icon + message + retry button (ARIA-live `assertive`, U-064)
 *
 * Touch target of the retry button ≥ 44×44px (U-014).
 */
export function SaveIndicator({
  status,
  error,
  onRetry,
  className = "",
}: SaveIndicatorProps) {
  const { t } = useTranslation();

  if (status === "idle") return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-sm ${className}`}
      aria-live={status === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {/* ── Saving ─────────────────────────────────────────────────── */}
      {status === "saving" && (
        <>
          <Spinner size="sm" />
          <span className="text-text-muted">
            {t("autosave.saving")}
          </span>
        </>
      )}

      {/* ── Saved ──────────────────────────────────────────────────── */}
      {status === "saved" && (
        <>
          <svg
            className="h-4 w-4 text-success"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 8l3 3 7-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-success">{t("autosave.saved")}</span>
        </>
      )}

      {/* ── Error ──────────────────────────────────────────────────── */}
      {status === "error" && (
        <>
          <svg
            className="h-4 w-4 text-danger shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M8 5v3M8 10.5v.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-danger">
            {error ?? t("autosave.error")}
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-2 py-1 text-xs font-medium rounded border border-danger text-danger bg-transparent hover:bg-danger/10 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
            >
              {t("autosave.retry")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
