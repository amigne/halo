/**
 * Timezone-aware date/time formatting and UTC↔local conversion.
 *
 * Backend rule (T-120): UTC end-to-end. This module handles all display/saisie
 * conversions in the frontend via the native `Intl` API — no heavy library.
 *
 * DST is handled correctly because `Intl.DateTimeFormat` with an IANA
 * timezone name reads the host's tz database (T-121).
 */

// ── Public types ──────────────────────────────────────────────────────────────

/** Subset of Intl.DateTimeFormatOptions safe for our public API. */
export interface DateTimeFormatOpts {
  dateStyle?: "full" | "long" | "medium" | "short";
  timeStyle?: "full" | "long" | "medium" | "short";
  year?: "numeric" | "2-digit";
  month?: "numeric" | "2-digit" | "long" | "short" | "narrow";
  day?: "numeric" | "2-digit";
  weekday?: "long" | "short" | "narrow";
  hour?: "numeric" | "2-digit";
  minute?: "numeric" | "2-digit";
  second?: "numeric" | "2-digit";
  hour12?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract the UTC offset (in milliseconds) that `tz` applies at the given
 * `utcTimestamp`. Used internally by `toUtcIso`.
 */
function tzOffsetMs(tz: string, utcTimestamp: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(utcTimestamp));

  const tzStr = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  const m = tzStr.match(/GMT([+-]\d{2}):(\d{2})/);
  if (!m) {
    throw new Error(
      `Cannot determine UTC offset for timezone "${tz}" at ${utcTimestamp}`,
    );
  }

  const sign = m[1]!.startsWith("-") ? -1 : 1;
  const totalMinutes = Math.abs(Number(m[1])) * 60 + Number(m[2]);
  return sign * totalMinutes * 60 * 1000;
}

/**
 * Parse a datetime-local input string into its numeric components.
 * Accepts `YYYY-MM-DDTHH:MM` or `YYYY-MM-DDTHH:MM:SS`.
 */
function parseLocalInput(input: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const m = input.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!m) {
    throw new Error(
      `Invalid datetime-local input: "${input}". Expected YYYY-MM-DDTHH:MM[:SS].`,
    );
  }
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
    second: m[6] !== undefined ? Number(m[6]) : 0,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Format a UTC ISO-8601 string in the given timezone and locale.
 *
 * @param utcIso  ISO-8601 string with Z suffix (e.g. "2026-03-15T14:30:00Z").
 * @param tz      IANA timezone name (e.g. "Europe/Paris").
 * @param lang    BCP 47 language tag (e.g. "fr", "en").
 * @param opts    Optional Intl.DateTimeFormat overrides.
 */
export function formatDateTime(
  utcIso: string,
  tz: string,
  lang: string,
  opts?: DateTimeFormatOpts,
): string {
  const date = new Date(utcIso);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid UTC ISO date: "${utcIso}"`);
  }

  return new Intl.DateTimeFormat(lang, {
    timeZone: tz,
    ...opts,
  } as Intl.DateTimeFormatOptions).format(date);
}

/**
 * Shortcut: date-only formatting (long month, numeric day & year).
 *
 * Examples:
 *   fr → "15 mars 2026"
 *   en → "March 15, 2026"
 */
export function formatDate(utcIso: string, tz: string, lang: string): string {
  return formatDateTime(utcIso, tz, lang, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Shortcut: time-only formatting (2-digit hours & minutes, 24h for fr, 12h for en).
 */
export function formatTime(utcIso: string, tz: string, lang: string): string {
  return formatDateTime(utcIso, tz, lang, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a number according to the given locale.
 *
 * Examples:
 *   formatNumber(1234567.89, "fr") -> "1 234 567,89" (thin spaces, U+202F)
 *   formatNumber(1234567.89, "en") → "1,234,567.89"
 */
export function formatNumber(n: number, lang: string): string {
  return new Intl.NumberFormat(lang).format(n);
}

/**
 * Convert a local datetime input (from `<input type="datetime-local">`) into a
 * UTC ISO-8601 string ready to send to the backend.
 *
 * The conversion uses the IANA timezone `tz` to determine the correct UTC
 * offset, including DST, for the specific wall-clock instant entered by the
 * user (T-122).
 *
 * @param localInput  A string like "2026-03-29T14:30" (wall-clock in tz).
 * @param tz          IANA timezone of the user (e.g. "Europe/Paris").
 * @returns           ISO-8601 UTC string (e.g. "2026-03-29T12:30:00.000Z").
 */
export function toUtcIso(localInput: string, tz: string): string {
  const { year, month, day, hour, minute, second } = parseLocalInput(localInput);

  // Step 1 — naive UTC: treat wall-clock values as if they were UTC
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);

  // Step 2 — determine the offset that applies at that naive UTC instant
  const offset1 = tzOffsetMs(tz, naiveUtcMs);
  let utcMs = naiveUtcMs - offset1;

  // Step 3 — refine: if the offset differs at the computed UTC instant
  // (DST boundary crossing), re-apply with the corrected offset.
  const offset2 = tzOffsetMs(tz, utcMs);
  if (offset2 !== offset1) {
    utcMs = naiveUtcMs - offset2;
  }

  return new Date(utcMs).toISOString();
}

/**
 * Return the effective timezone to use for display/conversion.
 *
 * - If `prefTz` is provided (e.g. from user profile), it is returned as-is.
 * - Otherwise, the browser's system timezone is returned via
 *   `Intl.DateTimeFormat().resolvedOptions().timeZone`.
 *
 * This ensures the frontend **never** uses the server's system timezone
 * (T-123 / F-034).
 */
export function currentTimezone(prefTz?: string): string {
  if (prefTz) return prefTz;
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
