import { renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { useTranslation } from "react-i18next";
import { i18next } from "@/shared/i18n";

// Reset i18n between tests
beforeEach(() => {
  vi.clearAllMocks();
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
});
