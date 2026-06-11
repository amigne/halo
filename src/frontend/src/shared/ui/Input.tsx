import { type InputHTMLAttributes, useId } from "react";

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  /** HTML id for label association. Auto-generated if omitted. */
  id?: string;
  /** Visible label text. */
  label: string;
  /** Error message — sets aria-invalid and displays inline. */
  error?: string;
}

/**
 * Accessible text input with label and error state.
 *
 * - Label associated via `htmlFor`/`id`
 * - `aria-invalid` + `aria-describedby` when error is present
 * - Focus ring uses `--color-focus-ring` token
 * - Error message with `role="alert"` for live announcement
 */
export function Input({
  id: propId,
  label,
  error,
  className = "",
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = propId ?? generatedId;
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-sm font-medium text-text"
      >
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`min-h-[44px] px-3 py-2 rounded-md border bg-surface text-text placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none ${
          error ? "border-danger" : "border-border"
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
