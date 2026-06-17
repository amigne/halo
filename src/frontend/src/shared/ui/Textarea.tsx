import { type TextareaHTMLAttributes, useId } from "react";

interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  /** HTML id for label association. Auto-generated if omitted. */
  id?: string;
  /** Visible label text. */
  label: string;
  /** Error message — sets aria-invalid and displays inline. */
  error?: string;
}

/**
 * Accessible multiline text input with label and error state.
 *
 * - Label associated via `htmlFor`/`id`
 * - `aria-invalid` + `aria-describedby` when error is present
 * - Error message with `role="alert"` for live announcement
 * - Focus ring uses tokens (--color-focus-ring)
 * - Touch target ≥ 44px on coarse pointers only
 */
export function Textarea({
  id: propId,
  label,
  error,
  className = "",
  rows = 4,
  ...props
}: TextareaProps) {
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
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-md border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none resize-vertical [@media(pointer:coarse)]:min-h-11 ${
          error ? "border-danger" : "border-border-strong"
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
