import { useTranslation } from "react-i18next";

// ── Props ──────────────────────────────────────────────────────────────────────

export interface IconPickerProps {
  /** Currently selected icon key (empty string = none). */
  value: string;
  /** Called when the user selects an icon. */
  onChange: (iconKey: string) => void;
  /** Optional label for the picker. */
  label?: string;
  /** Whether the picker is disabled. */
  disabled?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * IconPicker — stub placeholder (étape 3-10).
 *
 * Displays a simple text input showing the current icon key + an icon placeholder.
 * The real icon search + SVG gallery will be implemented in étape 4 and will
 * **replace** this component while keeping the same public API (value/onChange).
 *
 * A11y: labelled via `aria-label`, disabled state supported.
 */
export function IconPicker({
  value,
  onChange,
  label,
  disabled = false,
}: IconPickerProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3">
      {/* Visual placeholder — real SVG preview in étape 4 */}
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-md border border-border bg-surface shrink-0 ${
          disabled ? "opacity-50" : ""
        }`}
        aria-hidden="true"
      >
        {value ? (
          <span className="text-lg text-text-muted">★</span>
        ) : (
          <span className="text-lg text-text-muted opacity-30">☆</span>
        )}
      </div>

      {/* Stub: plain text input for the icon key */}
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label ?? t("ui.iconPicker.placeholder")}
        placeholder={t("ui.iconPicker.placeholder")}
        className={`min-h-[44px] w-full max-w-[200px] px-3 py-2 rounded-md border bg-surface text-text placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none ${
          disabled
            ? "opacity-50 pointer-events-none"
            : ""
        } border-border`}
      />
    </div>
  );
}
