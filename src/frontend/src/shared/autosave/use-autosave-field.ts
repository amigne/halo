import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseAutosaveFieldOptions {
  /** Current value from the parent component / API. */
  value: string;
  /** Key used to build the PATCH partial (e.g. `"title"` → `{ title: newValue }`). */
  fieldKey: string;
  /**
   * Async callback that sends a PATCH partial to the server (T-063).
   * Receives `{ [fieldKey]: newValue }`.
   */
  onPatch: (partial: Record<string, string>) => Promise<void>;
  /** Debounce delay in milliseconds (default: 500, per T-133). */
  debounceMs?: number;
}

/** Minimal keyboard event — satisfied by both DOM and React synthetic events. */
export interface AutosaveKeyEvent {
  key: string;
  preventDefault(): void;
  stopPropagation(): void;
}

export interface UseAutosaveFieldReturn {
  /** The current local (potentially unsaved) value. */
  localValue: string;
  /** Call on every keystroke / change to update local value. */
  onChange: (next: string) => void;
  /** Call on blur to trigger a debounced save. */
  onBlur: () => void;
  /**
   * Keyboard handler for Escape (U-062, U-063).
   * - If the field is dirty → restores snapshot, returns `true` (event consumed).
   * - If the field is clean → returns `false` (let the modal handle close).
   */
  handleKeyDown: (e: AutosaveKeyEvent) => boolean;
  /** Current save status for the indicator. */
  status: SaveStatus;
  /** Error message when status is `"error"`, `null` otherwise. */
  error: string | null;
  /** Retry the last failed save. */
  retry: () => void;
  /** Whether the local value differs from the last persisted snapshot. */
  isDirty: boolean;
  /**
   * Force-flush any pending debounced save immediately.
   * Called by the parent modal before closing (U-061).
   */
  flush: () => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Autosave field hook — manages local editing state, debounced PATCH persistence
 * on blur / modal close, Escape-to-restore, and save-status tracking.
 *
 * Implements the save‑less editing model (U-060–U-065, U-126, T-063, T-133).
 */
export function useAutosaveField({
  value,
  fieldKey,
  onPatch,
  debounceMs = 500,
}: UseAutosaveFieldOptions): UseAutosaveFieldReturn {
  // ── State ──────────────────────────────────────────────────────────────────

  const [localValue, setLocalValue] = useState<string>(value);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Last successfully persisted value (snapshot for Escape – U-062)
  const snapshotRef = useRef<string>(value);
  // The value we most recently attempted to persist
  const pendingValueRef = useRef<string | null>(null);
  // Debounce timer
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the latest onPatch to avoid stale closures in the debounced save
  const onPatchRef = useRef(onPatch);
  onPatchRef.current = onPatch;

  // Sync snapshot when the external value changes (e.g. after another field's save)
  useEffect(() => {
    snapshotRef.current = value;
    // Only reset local value if we're not currently editing
    if (status === "idle" || status === "saved") {
      setLocalValue(value);
    }
  }, [value, status]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // ── Save logic ─────────────────────────────────────────────────────────────

  const save = useCallback(
    async (valueToSave: string) => {
      if (valueToSave === snapshotRef.current) {
        // Nothing changed — skip
        setStatus("idle");
        return;
      }

      pendingValueRef.current = valueToSave;
      setStatus("saving");
      setError(null);

      try {
        await onPatchRef.current({ [fieldKey]: valueToSave });
        // Success — update snapshot
        snapshotRef.current = valueToSave;
        pendingValueRef.current = null;
        setStatus("saved");
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        setStatus("error");
        setError(message);
      }
    },
    [fieldKey],
  );

  // ── Debounced save ─────────────────────────────────────────────────────────

  const debouncedSave = useCallback(
    (valueToSave: string) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        save(valueToSave);
      }, debounceMs);
    },
    [debounceMs, save],
  );

  // ── Public API ─────────────────────────────────────────────────────────────

  const onChange = useCallback((next: string) => {
    setLocalValue(next);
    // Reset saved indicator when user starts typing again
    setStatus((prev) => (prev === "saved" || prev === "error" ? "idle" : prev));
  }, []);

  const onBlur = useCallback(() => {
    if (localValue !== snapshotRef.current) {
      debouncedSave(localValue);
    }
  }, [localValue, debouncedSave]);

  const handleKeyDown = useCallback(
    (e: AutosaveKeyEvent): boolean => {
      if (e.key !== "Escape") return false;

      if (localValue !== snapshotRef.current) {
        // U-062: restore snapshot, don't close modal
        e.preventDefault();
        e.stopPropagation();
        setLocalValue(snapshotRef.current);
        setStatus("idle");
        setError(null);
        // Cancel any pending debounced save
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        return true; // event consumed
      }

      // U-063: field is clean — let modal handle Escape
      return false;
    },
    [localValue],
  );

  const retry = useCallback(() => {
    const toRetry = pendingValueRef.current ?? localValue;
    save(toRetry);
  }, [localValue, save]);

  const flush = useCallback(() => {
    // Cancel debounce and save immediately if dirty
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (localValue !== snapshotRef.current) {
      save(localValue);
    }
  }, [localValue, save]);

  const isDirty = localValue !== snapshotRef.current;

  return {
    localValue,
    onChange,
    onBlur,
    handleKeyDown,
    status,
    error,
    retry,
    isDirty,
    flush,
  };
}
