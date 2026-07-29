import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./fr.json";
import en from "./en.json";

export const LANGUAGES = ["fr", "en"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "fr";
export const LANGUAGE_COOKIE = "winstorr_lang";

export function isLanguage(v: unknown): v is Language {
  return v === "fr" || v === "en";
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    // Always start on the default locale so SSR markup matches the first
    // client render; the stored preference is applied after hydration.
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default i18n;
