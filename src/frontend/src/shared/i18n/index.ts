import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

const storedLang = localStorage.getItem("halo-lang");

i18next.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: storedLang || "fr",
  fallbackLng: "fr",
  interpolation: {
    escapeValue: false,
  },
});

// Persist language choice on every change (covers all call sites) — U-100/U-104
i18next.on("languageChanged", (lng) => {
  localStorage.setItem("halo-lang", lng);
});

export { i18next };
