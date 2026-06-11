import { useTranslation } from "react-i18next";

// ── Props ──────────────────────────────────────────────────────────────────────

export interface TagEditorProps {
  /** Current tag string value (e.g. `"{TASK:42} {NOTE:7}"`). */
  value: string;
  /** Called when the tag string changes. */
  onChange: (value: string) => void;
  /** Whether the editor is disabled. */
  disabled?: boolean;
  /** Variant: `"single"` = one-line `<input>`, `"multiline"` = `<textarea>`. */
  variant?: "single" | "multiline";
  /** Placeholder text for the empty state. */
  placeholder?: string;
  /** Optional label for ARIA. */
  label?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * TagEditor — stub placeholder (étape 3-10).
 *
 * Renders a plain text field (input or textarea) for tag strings.
 * The real tag editor (autocompletion, chip rendering, click-to-navigate) will be
 * implemented in étape 5 and will **replace** this component while keeping the
 * same public API (value/onChange + variant).
 *
 * Variants:
 * - `"single"` (default) → `<input type="text">` for titles
 * - `"multiline"` → `<textarea>` for descriptions / notes
 *
 * A11y: labelled via `aria-label` or associated `<label>`.
 */
export function TagEditor({
  value,
  onChange,
  disabled = false,
  variant = "single",
  placeholder,
  label,
}: TagEditorProps) {
  const { t } = useTranslation();

  const disabledClasses = disabled
    ? "opacity-50 pointer-events-none"
    : "";

  const baseClasses = `min-h-[44px] w-full px-3 py-2 rounded-md border bg-surface text-text placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none border-border ${disabledClasses}`;

  const placeholderText =
    placeholder ?? t("ui.tagEditor.placeholder");

  if (variant === "multiline") {
    return (
      <textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label ?? t("ui.tagEditor.label")}
        placeholder={placeholderText}
        rows={4}
        className={`${baseClasses} resize-y`}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label ?? t("ui.tagEditor.label")}
      placeholder={placeholderText}
      className={baseClasses}
    />
  );
}
