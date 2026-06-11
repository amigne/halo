import { type ReactNode, useId } from "react";
import { useAutosaveField } from "./use-autosave-field";
import { SaveIndicator } from "./SaveIndicator";
import type { UseAutosaveFieldOptions, UseAutosaveFieldReturn } from "./use-autosave-field";

// ── Props ──────────────────────────────────────────────────────────────────────

export interface AutosaveFieldProps extends UseAutosaveFieldOptions {
  /** HTML id for label association. Auto-generated if omitted. */
  id?: string;
  /** Visible label text. */
  label: string;
  /**
   * Custom render function for the input slot (headless-friendly — U-065).
   *
   * Receives the hook API so callers can wire any editor (Input, TagEditor from
   * étape 5, etc.) without changing the AutosaveField wrapper.
   *
   * If omitted, renders a plain `<input type="text">` as a sensible default.
   */
  renderInput?: (api: UseAutosaveFieldReturn & { inputId: string }) => ReactNode;
  /** Extra CSS classes for the wrapper. */
  className?: string;
}

// ── Default input renderer ─────────────────────────────────────────────────────

function DefaultInput({
  api,
  inputId,
}: {
  api: UseAutosaveFieldReturn;
  inputId: string;
}) {
  return (
    <input
      id={inputId}
      type="text"
      value={api.localValue}
      onChange={(e) => api.onChange(e.target.value)}
      onBlur={api.onBlur}
      onKeyDown={api.handleKeyDown}
      className="min-h-[44px] w-full px-3 py-2 rounded-md border bg-surface text-text placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none border-border"
    />
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Autosave field wrapper — label + editable slot + save indicator.
 *
 * Headless-friendly (U-065): accepts a `renderInput` function to plug in custom
 * editors (e.g. TagEditor from étape 5) without changing the API.
 *
 * Uses `useAutosaveField` for debounced PATCH-on-blur / modal-close, Escape-to-
 * restore, and save-status tracking (U-060–U-065, U-126, T-063, T-133).
 */
export function AutosaveField({
  id: propId,
  label,
  renderInput,
  className = "",
  ...hookOptions
}: AutosaveFieldProps) {
  const generatedId = useId();
  const id = propId ?? generatedId;

  const api = useAutosaveField(hookOptions);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* Label + indicator row */}
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
        </label>
        <SaveIndicator
          status={api.status}
          error={api.error}
          onRetry={api.retry}
        />
      </div>

      {/* Input slot */}
      {renderInput ? (
        renderInput({ ...api, inputId: id })
      ) : (
        <DefaultInput api={api} inputId={id} />
      )}
    </div>
  );
}
