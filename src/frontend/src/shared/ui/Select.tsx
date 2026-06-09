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
 * - Focus ring uses `--color-focus-ring` token
 * - Error message with `role="alert"`
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
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`min-h-[44px] px-3 py-2 rounded-md border bg-surface text-text focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${
          error ? "border-danger" : "border-border"
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
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
