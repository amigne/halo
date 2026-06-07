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

export { i18next };
export { default as i18n } from "i18next";
