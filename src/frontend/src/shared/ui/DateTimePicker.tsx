import { type ChangeEvent, useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toUtcIso } from "@/shared/datetime/format";

interface DateTimePickerProps {
  /** HTML id for label association. Auto-generated if omitted. */
  id?: string;
  /** Visible label text. */
  label: string;
  /** ISO-8601 UTC string value (e.g. "2026-03-15T14:30:00.000Z"). */
  value: string;
  /** Called with a new ISO-8601 UTC string. */
  onChange: (utcIso: string) => void;
  /** IANA timezone for display/conversion (e.g. "Europe/Paris"). */
  timezone: string;
  /** Error message — sets aria-invalid and displays inline. */
  error?: string;
  /** Minimum allowed UTC ISO value. */
  min?: string;
  /** Maximum allowed UTC ISO value. */
  max?: string;
}

/**
 * Convert a UTC ISO string to a datetime-local input value (YYYY-MM-DDTHH:MM)
 * in the given IANA timezone, independent of the display locale.
 *
 * Uses Intl.DateTimeFormat with `formatToParts` on a fixed format locale
 * (`sv-SE`) that natively produces ISO-8601-like date ordering.
 */
function toLocalDatetimeInput(utcIso: string, tz: string): string {
  try {
    const date = new Date(utcIso);
    if (isNaN(date.getTime())) return "";

    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const get = (type: string): string =>
      parts.find((p) => p.type === type)?.value ?? "00";

    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  } catch {
    return "";
  }
}

/**
 * Accessible date/time picker.
 *
 * - Displays the UTC value in the user's timezone via `formatToParts`
 * - Converts local input back to UTC via `toUtcIso` before calling `onChange`
 * - Uses native `<input type="datetime-local">` for broad accessibility
 * - `aria-label` + `aria-invalid` + `aria-describedby` for error state
 */
export function DateTimePicker({
  id: propId,
  label,
  value,
  onChange,
  timezone,
  error,
  min,
  max,
}: DateTimePickerProps) {
  const generatedId = useId();
  const id = propId ?? generatedId;
  const errorId = `${id}-error`;
  const { t } = useTranslation();

  // Convert UTC ISO → local datetime-local string (YYYY-MM-DDTHH:MM)
  const localValue = useMemo(
    () => toLocalDatetimeInput(value, timezone),
    [value, timezone],
  );

  // Convert min/max UTC → local
  const localMin = useMemo(
    () => (min ? toLocalDatetimeInput(min, timezone) : undefined),
    [min, timezone],
  );

  const localMax = useMemo(
    () => (max ? toLocalDatetimeInput(max, timezone) : undefined),
    [max, timezone],
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const localInput = e.target.value;
    if (!localInput) return;
    try {
      const utcIso = toUtcIso(localInput, timezone);
      onChange(utcIso);
    } catch {
      // Invalid input — ignore silently
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <input
        id={id}
        type="datetime-local"
        value={localValue}
        onChange={handleChange}
        min={localMin}
        max={localMax}
        aria-label={t("ui.dateTimePicker.selectDate")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`min-h-[44px] px-3 py-2 rounded-md border bg-surface text-text focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none ${
          error ? "border-danger" : "border-border"
        }`}
      />
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
