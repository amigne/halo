import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

// ── Browser language detection ────────────────────────────────────────────────
// Default: navigator.language if it starts with "fr" or "en", otherwise "en".
function detectLang(): "fr" | "en" {
  if (typeof navigator !== "undefined") {
    const nav = navigator.language?.split("-")[0]?.toLowerCase();
    if (nav === "fr" || nav === "en") return nav;
  }
  return "en";
}

const storedLang = localStorage.getItem("halo.lang") as "fr" | "en" | null;

i18next.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: storedLang ?? detectLang(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  // i18next plural rules: "en" uses _one/_other via Intl.PluralRules;
  // "fr" uses _one/_other (French plural: one for 0/1, other for >=2).
});

// Persist language choice on every change (covers all call sites) — U-100/U-104
i18next.on("languageChanged", (lng) => {
  localStorage.setItem("halo.lang", lng);
  // Keep <html lang> in sync
  document.documentElement.lang = lng;
});

export { i18next };
