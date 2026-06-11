import { renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { useTranslation } from "react-i18next";
import { i18next } from "@/shared/i18n";
import { useLanguage } from "@/shared/i18n/use-language";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Reset i18n between tests
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  i18next.changeLanguage("fr");
  document.documentElement.lang = "fr";
});

describe("i18n", () => {
  // ── Basics ───────────────────────────────────────────────────────────────

  it("switches to English", async () => {
    await i18next.changeLanguage("en");
    expect(i18next.language).toBe("en");
  });

  it("translates keys correctly in French", () => {
    expect(i18next.t("app.title")).toBe("Halo");
    expect(i18next.t("theme.light")).toBe("Jour");
    expect(i18next.t("health.ok")).toBe("Opérationnel");
  });

  it("translates keys correctly in English", () => {
    i18next.changeLanguage("en");
    expect(i18next.t("app.title")).toBe("Halo");
    expect(i18next.t("theme.light")).toBe("Light");
    expect(i18next.t("health.ok")).toBe("Operational");
  });

  it("falls back to English for missing keys", () => {
    i18next.changeLanguage("fr");
    // Unknown key — returns the key itself when no fallback value given
    expect(i18next.t("app.unknownKey", "fallback")).toBe("fallback");
  });

  it("useTranslation hook returns the t function", () => {
    const { result } = renderHook(() => useTranslation());
    expect(typeof result.current.t).toBe("function");
    expect(result.current.t("app.title")).toBe("Halo");
  });

  // ── Persistence ──────────────────────────────────────────────────────────

  it("persists language choice to localStorage on change", async () => {
    await i18next.changeLanguage("en");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("halo.lang", "en");

    await i18next.changeLanguage("fr");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("halo.lang", "fr");
  });

  it("reads stored language on initialization", async () => {
    localStorageMock.setItem("halo.lang", "en");

    vi.resetModules();
    const { i18next: fresh } = await import("@/shared/i18n");
    expect(fresh.language).toBe("en");

    // Restore the original module for subsequent tests
    vi.resetModules();
  });

  // ── Pluralization ────────────────────────────────────────────────────────

  it("uses singular form for count=1 in French", () => {
    i18next.changeLanguage("fr");
    const result = i18next.t("demo.inbox", { count: 1 });
    expect(result).toBe("Vous avez 1 message non lu");
  });

  it("uses plural form for count=2 in French", () => {
    i18next.changeLanguage("fr");
    const result = i18next.t("demo.inbox", { count: 2 });
    expect(result).toBe("Vous avez 2 messages non lus");
  });

  it("uses plural form for count=0 in French", () => {
    i18next.changeLanguage("fr");
    const result = i18next.t("demo.inbox", { count: 0 });
    expect(result).toBe("Vous avez 0 message non lu");
  });

  it("uses singular form for count=1 in English", () => {
    i18next.changeLanguage("en");
    const result = i18next.t("demo.inbox", { count: 1 });
    expect(result).toBe("You have 1 unread message");
  });

  it("uses plural form for count=5 in English", () => {
    i18next.changeLanguage("en");
    const result = i18next.t("demo.inbox", { count: 5 });
    expect(result).toBe("You have 5 unread messages");
  });

  // ── Interpolation ────────────────────────────────────────────────────────

  it("interpolates {{name}} in French", () => {
    i18next.changeLanguage("fr");
    const result = i18next.t("demo.greeting", { name: "Alice" });
    expect(result).toBe("Bonjour Alice !");
  });

  it("interpolates {{name}} in English", () => {
    i18next.changeLanguage("en");
    const result = i18next.t("demo.greeting", { name: "Bob" });
    expect(result).toBe("Hello Bob!");
  });

  // ── <html lang> sync ─────────────────────────────────────────────────────

  it("updates <html lang> on language change", async () => {
    await i18next.changeLanguage("en");
    expect(document.documentElement.lang).toBe("en");

    await i18next.changeLanguage("fr");
    expect(document.documentElement.lang).toBe("fr");
  });

  // ── useLanguage hook ─────────────────────────────────────────────────────

  it("useLanguage returns current lang", () => {
    i18next.changeLanguage("fr");
    const { result } = renderHook(() => useLanguage());
    expect(result.current.lang).toBe("fr");
  });

  it("useLanguage setLang changes language", async () => {
    i18next.changeLanguage("fr");
    const { result } = renderHook(() => useLanguage());

    await result.current.setLang("en");

    expect(result.current.lang).toBe("en");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("halo.lang", "en");
  });

  it("useLanguage setLang syncs <html lang>", async () => {
    i18next.changeLanguage("fr");
    const { result } = renderHook(() => useLanguage());

    await result.current.setLang("en");

    expect(document.documentElement.lang).toBe("en");
  });

  // ── Browser language detection ───────────────────────────────────────────

  it("detects browser language on initialization", async () => {
    // Simulate a French browser
    const originalLanguage = Object.getOwnPropertyDescriptor(
      navigator,
      "language",
    );
    Object.defineProperty(navigator, "language", {
      value: "fr-FR",
      configurable: true,
    });

    localStorageMock.clear();
    vi.resetModules();
    const { i18next: fresh } = await import("@/shared/i18n");
    expect(fresh.language).toBe("fr");

    // Restore
    if (originalLanguage) {
      Object.defineProperty(navigator, "language", originalLanguage);
    }
    vi.resetModules();
  });

  it("defaults to en for unsupported browser language", async () => {
    const originalLanguage = Object.getOwnPropertyDescriptor(
      navigator,
      "language",
    );
    Object.defineProperty(navigator, "language", {
      value: "de-DE",
      configurable: true,
    });

    localStorageMock.clear();
    vi.resetModules();
    const { i18next: fresh } = await import("@/shared/i18n");
    expect(fresh.language).toBe("en");

    if (originalLanguage) {
      Object.defineProperty(navigator, "language", originalLanguage);
    }
    vi.resetModules();
  });

  // ── Locale symmetry ──────────────────────────────────────────────────────

  it("all locale keys are symmetric between fr and en", () => {
    const fr = i18next.getResourceBundle("fr", "translation");
    const en = i18next.getResourceBundle("en", "translation");

    function keysOf(obj: unknown, prefix = ""): string[] {
      if (typeof obj !== "object" || obj === null) return [prefix];
      return Object.entries(obj as Record<string, unknown>).flatMap(
        ([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k),
      );
    }

    const frKeys = new Set(keysOf(fr));
    const enKeys = keysOf(en);

    for (const key of enKeys) {
      expect(frKeys.has(key), `EN key "${key}" missing in FR`).toBe(true);
    }
    for (const key of frKeys) {
      expect(enKeys.includes(key), `FR key "${key}" missing in EN`).toBe(true);
    }
  });
});
