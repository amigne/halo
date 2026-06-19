import { type SelectHTMLAttributes, useId } from "react";
import { useTranslation } from "react-i18next";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "onChange"> {
  /** HTML id for label association. Auto-generated if omitted. */
  id?: string;
  /** Visible label text. */
  label: string;
  /** Available options. */
  options: SelectOption[];
  /** Controlled value. */
  value: string;
  /** Called with the new value string. */
  onChange: (value: string) => void;
  /** Error message — sets aria-invalid and displays inline. */
  error?: string;
  /** Placeholder option (rendered as disabled, value=""). */
  placeholder?: string;
}

/**
 * Accessible select dropdown via native `<select>`.
 *
 * - Label associated via `htmlFor`/`id`
 * - `aria-invalid` + `aria-describedby` when error is present
 * - Focus ring uses tokens (--color-focus-ring)
 * - Error message with `role="alert"`
 * - Chevron icon via CSS background (no extra DOM)
 */
export function Select({
  id: propId,
  label,
  options,
  value,
  onChange,
  error,
  placeholder,
  disabled,
  className = "",
  ...props
}: SelectProps) {
  const generatedId = useId();
  const id = propId ?? generatedId;
  const errorId = `${id}-error`;
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full appearance-none rounded-md border bg-surface px-3 py-2 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer [@media(pointer:coarse)]:min-h-11 ${
            error ? "border-danger" : "border-border-strong"
          } ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {!placeholder && options.length === 0 && (
            <option value="" disabled>
              {t("ui.select.placeholder")}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {/* Chevron icon — CSS-only, matches Input styling */}
        <svg
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
