import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatDate,
  formatTime,
  formatNumber,
  toUtcIso,
  currentTimezone,
} from "@/shared/datetime/format";

// ── Shared test constants ─────────────────────────────────────────────────────

const TZ_PARIS = "Europe/Paris";
const TZ_NY = "America/New_York";

// A known UTC instant: March 15, 2026 14:30 UTC
// In Paris (CET, UTC+1 in March): 15:30
// In New York (EDT, UTC-4 in March): 10:30
const UTC_ISO = "2026-03-15T14:30:00Z";

// ── formatDateTime ────────────────────────────────────────────────────────────

describe("formatDateTime", () => {
  it("formats a UTC instant in Europe/Paris (fr)", () => {
    const result = formatDateTime(UTC_ISO, TZ_PARIS, "fr", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    // March 15 2026, 15:30 in Paris
    expect(result).toMatch(/15 mars 2026/);
    expect(result).toMatch(/15:30/);
  });

  it("formats a UTC instant in Europe/Paris (en)", () => {
    const result = formatDateTime(UTC_ISO, TZ_PARIS, "en", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(result).toMatch(/March 15, 2026/);
    expect(result).toMatch(/03:30 PM/);
  });

  it("formats in America/New_York", () => {
    const result = formatDateTime(UTC_ISO, TZ_NY, "en", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    // EDT is UTC-4, so 14:30 UTC = 10:30 AM in New York
    expect(result).toMatch(/March 15, 2026/);
    expect(result).toMatch(/10:30/);
  });

  it("respects custom dateStyle", () => {
    const result = formatDateTime(UTC_ISO, TZ_PARIS, "fr", {
      dateStyle: "full",
    });
    // "dimanche 15 mars 2026" in fr
    expect(result).toMatch(/dimanche/);
    expect(result).toMatch(/15 mars 2026/);
  });

  it("respects custom timeStyle", () => {
    const result = formatDateTime(UTC_ISO, TZ_PARIS, "fr", {
      timeStyle: "short",
    });
    // "15:30" in fr 24h
    expect(result).toMatch(/15:30/);
  });

  it("throws on invalid UTC ISO string", () => {
    expect(() => formatDateTime("not-a-date", TZ_PARIS, "fr")).toThrow(
      'Invalid UTC ISO date: "not-a-date"',
    );
  });
});

// ── formatDate ────────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats date in French", () => {
    const result = formatDate(UTC_ISO, TZ_PARIS, "fr");
    expect(result).toBe("15 mars 2026");
  });

  it("formats date in English", () => {
    const result = formatDate(UTC_ISO, TZ_PARIS, "en");
    expect(result).toBe("March 15, 2026");
  });

  it("shows correct date across timezone boundary", () => {
    // 2026-03-15T23:00:00Z → still March 15 in UTC, but already March 16 in
    // Europe/Paris (CET, UTC+1)
    const lateUtc = "2026-03-15T23:00:00Z";
    const result = formatDate(lateUtc, TZ_PARIS, "fr");
    expect(result).toBe("16 mars 2026");
  });
});

// ── formatTime ────────────────────────────────────────────────────────────────

describe("formatTime", () => {
  it("formats time in French (24h)", () => {
    const result = formatTime(UTC_ISO, TZ_PARIS, "fr");
    expect(result).toBe("15:30");
  });

  it("formats time in English (12h)", () => {
    const result = formatTime(UTC_ISO, TZ_PARIS, "en");
    expect(result).toBe("03:30 PM");
  });

  it("shows correct time in morning hours", () => {
    // 08:00 UTC = 09:00 CET (Paris, winter)
    const morning = "2026-01-15T08:00:00Z";
    const result = formatTime(morning, TZ_PARIS, "fr");
    expect(result).toBe("09:00");
  });
});

// ── formatNumber ──────────────────────────────────────────────────────────────

describe("formatNumber", () => {
  it("formats number in French (thin-space thousands, comma decimal)", () => {
    const result = formatNumber(1234567.89, "fr");
    // U+202F = narrow no-break space, used as thousands separator in fr
    expect(result).toMatch(/^1.234.567,89$/);
    // The dot here is actually a thin space — just verify structure
    expect(result).toContain("567");
    expect(result).toContain(",89");
  });

  it("formats number in English", () => {
    const result = formatNumber(1234567.89, "en");
    expect(result).toBe("1,234,567.89");
  });

  it("formats integer", () => {
    expect(formatNumber(42, "fr")).toBe("42");
    expect(formatNumber(42, "en")).toBe("42");
  });

  it("formats negative number", () => {
    const fr = formatNumber(-1500.5, "fr");
    const en = formatNumber(-1500.5, "en");
    expect(fr).toMatch(/^-1/);
    expect(fr).toContain(",5");
    expect(en).toBe("-1,500.5");
  });
});

// ── toUtcIso ──────────────────────────────────────────────────────────────────

describe("toUtcIso", () => {
  it("converts a local datetime to UTC (winter, CET)", () => {
    // January is CET (UTC+1). 14:30 Paris = 13:30 UTC.
    const result = toUtcIso("2026-01-15T14:30", TZ_PARIS);
    expect(result).toBe("2026-01-15T13:30:00.000Z");
  });

  it("converts a local datetime to UTC (summer, CEST)", () => {
    // July is CEST (UTC+2). 14:30 Paris = 12:30 UTC.
    const result = toUtcIso("2026-07-15T14:30", TZ_PARIS);
    expect(result).toBe("2026-07-15T12:30:00.000Z");
  });

  it("converts a local datetime to UTC (America/New_York, EST)", () => {
    // January is EST (UTC-5). 10:30 NY = 15:30 UTC.
    const result = toUtcIso("2026-01-15T10:30", TZ_NY);
    expect(result).toBe("2026-01-15T15:30:00.000Z");
  });

  it("converts a local datetime to UTC (America/New_York, EDT)", () => {
    // July is EDT (UTC-4). 10:30 NY = 14:30 UTC.
    const result = toUtcIso("2026-07-15T10:30", TZ_NY);
    expect(result).toBe("2026-07-15T14:30:00.000Z");
  });

  it("handles seconds in input", () => {
    const result = toUtcIso("2026-01-15T14:30:45", TZ_PARIS);
    expect(result).toBe("2026-01-15T13:30:45.000Z");
  });

  it("throws on invalid input format", () => {
    expect(() => toUtcIso("15/01/2026 14:30", TZ_PARIS)).toThrow(
      'Invalid datetime-local input: "15/01/2026 14:30"',
    );
  });

  // ── DST: spring forward (Europe/Paris, March 29, 2026) ──────────────────
  //
  // At 01:00 UTC (02:00 CET) clocks jump to 03:00 CEST.
  // Times between 02:00–02:59 local do NOT exist (gap).

  describe("DST — spring forward (March 29, 2026)", () => {
    it("converts 01:30 Paris (before transition, CET UTC+1)", () => {
      // 01:30 CET (UTC+1) → 00:30 UTC
      const result = toUtcIso("2026-03-29T01:30", TZ_PARIS);
      expect(result).toBe("2026-03-29T00:30:00.000Z");
    });

    it("converts 03:30 Paris (after transition, CEST UTC+2)", () => {
      // 03:30 CEST (UTC+2) → 01:30 UTC
      const result = toUtcIso("2026-03-29T03:30", TZ_PARIS);
      expect(result).toBe("2026-03-29T01:30:00.000Z");
    });

    it("round-trips correctly across the spring DST gap", () => {
      // Before transition: 01:30 CET
      const utcBefore = toUtcIso("2026-03-29T01:30", TZ_PARIS);
      const displayBefore = formatDateTime(utcBefore, TZ_PARIS, "fr", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      expect(displayBefore).toBe("01:30");

      // After transition: 03:30 CEST
      const utcAfter = toUtcIso("2026-03-29T03:30", TZ_PARIS);
      const displayAfter = formatDateTime(utcAfter, TZ_PARIS, "fr", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      expect(displayAfter).toBe("03:30");
    });
  });

  // ── DST: fall back (Europe/Paris, October 25, 2026) ─────────────────────
  //
  // At 01:00 UTC (03:00 CEST) clocks fall back to 02:00 CET.
  // Times between 02:00–02:59 local occur TWICE (first CEST, then CET).

  describe("DST — fall back (October 25, 2026)", () => {
    it("converts 02:30 Paris (ambigu — résolu en heure d'hiver CET UTC+1)", () => {
      // At 02:30 local, the naive UTC guess (02:30Z) is already past the
      // 01:00Z transition point where clocks fell back, so the algorithm
      // converges to the second occurrence: CET (UTC+1).
      // 02:30 CET (UTC+1) → 01:30 UTC.
      const result = toUtcIso("2026-10-25T02:30", TZ_PARIS);
      expect(result).toBe("2026-10-25T01:30:00.000Z");
    });

    it("converts 03:30 Paris winter time (CET UTC+1, after transition)", () => {
      // 03:30 CET (UTC+1) → 02:30 UTC
      const result = toUtcIso("2026-10-25T03:30", TZ_PARIS);
      expect(result).toBe("2026-10-25T02:30:00.000Z");
    });

    it("round-trips correctly across the fall DST overlap", () => {
      // Wall-clock 02:30 (resolved to second occurrence, CET UTC+1) → 01:30 UTC
      const utc = toUtcIso("2026-10-25T02:30", TZ_PARIS);
      expect(utc).toBe("2026-10-25T01:30:00.000Z");

      // Round-trip: formatting 01:30 UTC back → 02:30 local
      const display = formatDateTime(utc, TZ_PARIS, "fr", {
        hour: "2-digit",
        minute: "2-digit",
      });
      expect(display).toBe("02:30");

      // After transition: 03:30 CET → 02:30 UTC → display 03:30
      const utcWinter = toUtcIso("2026-10-25T03:30", TZ_PARIS);
      expect(utcWinter).toBe("2026-10-25T02:30:00.000Z");
      const displayWinter = formatDateTime(utcWinter, TZ_PARIS, "fr", {
        hour: "2-digit",
        minute: "2-digit",
      });
      expect(displayWinter).toBe("03:30");
    });

    it("produces distinct UTC times for the two occurrences of 02:30", () => {
      // The second occurrence (CET, UTC+1): 02:30 local → 01:30 UTC
      const second = toUtcIso("2026-10-25T02:30", TZ_PARIS);
      expect(second).toBe("2026-10-25T01:30:00.000Z");

      // Verify by formatting: 01:30 UTC → 02:30 local (winter, second occurrence)
      const displaySecond = formatDateTime(second, TZ_PARIS, "en", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      expect(displaySecond).toBe("02:30");

      // The first occurrence (CEST, UTC+2) can be demonstrated by formatting
      // 00:30 UTC, which also displays as 02:30 local (summer time).
      const displayFirst = formatDateTime(
        "2026-10-25T00:30:00.000Z",
        TZ_PARIS,
        "en",
        { hour: "2-digit", minute: "2-digit", hour12: false },
      );
      expect(displayFirst).toBe("02:30");
    });
  });

  // ── Other DST edge cases ────────────────────────────────────────────────

  it("handles America/New_York DST transition (spring forward)", () => {
    // March 8, 2026: EST→EDT. At 07:00 UTC, clocks jump from 02:00→03:00.
    // 01:30 EST (UTC-5) → 06:30 UTC
    const before = toUtcIso("2026-03-08T01:30", TZ_NY);
    expect(before).toBe("2026-03-08T06:30:00.000Z");

    // 03:30 EDT (UTC-4) → 07:30 UTC
    const after = toUtcIso("2026-03-08T03:30", TZ_NY);
    expect(after).toBe("2026-03-08T07:30:00.000Z");
  });

  it("handles Asia/Tokyo (no DST)", () => {
    // Japan doesn't observe DST (UTC+9 year-round).
    const winter = toUtcIso("2026-01-15T14:30", "Asia/Tokyo");
    expect(winter).toBe("2026-01-15T05:30:00.000Z");

    const summer = toUtcIso("2026-07-15T14:30", "Asia/Tokyo");
    expect(summer).toBe("2026-07-15T05:30:00.000Z");
  });
});

// ── currentTimezone ───────────────────────────────────────────────────────────

describe("currentTimezone", () => {
  it("returns the preferred timezone when provided", () => {
    const tz = currentTimezone("Europe/Zurich");
    expect(tz).toBe("Europe/Zurich");
  });

  it("returns the system timezone when no preference is given", () => {
    const tz = currentTimezone();
    // In our test environment (CI / Docker), this is typically "UTC".
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });

  it("returns the system timezone when preference is undefined", () => {
    const tz = currentTimezone(undefined);
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });
});

// ── Integration: round-trip consistency ───────────────────────────────────────

describe("UTC ↔ local round-trip", () => {
  it("preserves wall-clock time after toUtcIso → formatDateTime", () => {
    const inputs = [
      { local: "2026-01-15T09:00", tz: TZ_PARIS },
      { local: "2026-07-15T18:45", tz: TZ_PARIS },
      { local: "2026-01-15T08:00", tz: TZ_NY },
      { local: "2026-07-15T20:00", tz: TZ_NY },
      { local: "2026-06-15T12:00", tz: "Asia/Tokyo" },
    ];

    for (const { local, tz } of inputs) {
      const utc = toUtcIso(local, tz);
      const display = formatDateTime(utc, tz, "fr", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      // The display should show the same wall-clock components as the input.
      // Format is locale-dependent; we check key substrings.
      const [datePart, timePart] = local.split("T");
      const [y, mo, d] = datePart!.split("-");
      const [h, mi] = timePart!.split(":");

      expect(display).toContain(y);
      expect(display).toContain(mo);
      expect(display).toContain(d);
      expect(display).toContain(`${h}:${mi}`);
    }
  });
});
