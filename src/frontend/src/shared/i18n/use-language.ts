import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/**
 * Single-source language hook shared between topbar and profile (U-100..U-104).
 *
 * - `lang` reflects the current i18next language (always "fr" | "en").
 * - `setLang(l)` calls `i18n.changeLanguage(l)`, which persists to localStorage
 *   and syncs `<html lang>` — a single mutation path.
 */
export function useLanguage(): {
  lang: "fr" | "en";
  setLang: (l: "fr" | "en") => void;
} {
  const { i18n } = useTranslation();

  const lang = i18n.language as "fr" | "en";

  const setLang = useCallback(
    (l: "fr" | "en") => {
      void i18n.changeLanguage(l);
    },
    [i18n],
  );

  return { lang, setLang };
}
