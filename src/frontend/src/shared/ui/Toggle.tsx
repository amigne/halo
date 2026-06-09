import { useId } from "react";

interface ToggleProps {
  /** Whether the toggle is in the "on" position. */
  checked: boolean;
  /** Called with the new checked state. */
  onChange: (checked: boolean) => void;
  /** Accessible label for the switch. */
  label: string;
  /** Disables interaction. */
  disabled?: boolean;
  /** HTML id for label association. Auto-generated if omitted. */
  id?: string;
}

/**
 * Accessible toggle switch.
 *
 * - `role="switch"` + `aria-checked` for screen readers
 * - Label is clickable via `htmlFor`
 * - Focus ring uses `--color-focus-ring`
 * - Respects `prefers-reduced-motion` via the global CSS rule
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  id: propId,
}: ToggleProps) {
  const generatedId = useId();
  const id = propId ?? generatedId;

  return (
    <div className="flex items-center gap-3">
      <button
        id={id}
        role="switch"
        type="button"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${
          checked ? "bg-primary" : "bg-border"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <label htmlFor={id} className="text-sm font-medium text-text cursor-pointer">
        {label}
      </label>
    </div>
  );
}
