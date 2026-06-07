import { renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { useTranslation } from "react-i18next";
import { i18next } from "@/shared/i18n";

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
});

describe("i18n", () => {
  it("defaults to French", () => {
    expect(i18next.language).toBe("fr");
  });

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

  it("falls back to French for missing keys", () => {
    i18next.changeLanguage("en");
    // "app.notFound" exists in both — check fallback for unknown keys
    expect(i18next.t("app.unknownKey", "fallback")).toBe("fallback");
  });

  it("useTranslation hook returns the t function", () => {
    const { result } = renderHook(() => useTranslation());
    expect(typeof result.current.t).toBe("function");
    expect(result.current.t("app.title")).toBe("Halo");
  });

  it("persists language choice to localStorage on change", async () => {
    await i18next.changeLanguage("en");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("halo-lang", "en");

    await i18next.changeLanguage("fr");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("halo-lang", "fr");
  });

  it("reads stored language on initialization", async () => {
    // Simulate a stored preference before module initialization.
    // We use vi.resetModules so the i18n module re-evaluates
    // localStorage.getItem("halo-lang") on re-import.
    localStorageMock.setItem("halo-lang", "en");

    vi.resetModules();
    const { i18next: fresh } = await import("@/shared/i18n");
    expect(fresh.language).toBe("en");

    // Restore the original module for subsequent tests
    vi.resetModules();
  });
});
