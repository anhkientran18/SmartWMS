import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import vi from "./locales/vi.json";

// Read saved language from localStorage safely
const getInitialLanguage = (): string => {
  if (typeof window !== "undefined") {
    let saved: string | null = null;
    try { saved = localStorage.getItem("ui_lang"); } catch { /* storage unavailable */ }
    if (saved === "vi-VN" || saved === "en-US") {
      return saved;
    }
  }
  return "vi-VN";
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      "en-US": {
        translation: en,
        outboundForm: en.outboundForm,
        inboundForm: en.inboundForm,
        common: en.common,
      },
      "vi-VN": {
        translation: vi,
        outboundForm: vi.outboundForm,
        inboundForm: vi.inboundForm,
        common: vi.common,
      },
    },
    lng: getInitialLanguage(),
    fallbackLng: "en-US",
    keySeparator: ".",
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

// Keep localStorage in sync whenever language changes
i18n.on("languageChanged", (lng: string) => {
  if (typeof window !== "undefined") {
    try { localStorage.setItem("ui_lang", lng); } catch { /* storage unavailable */ }
    document.documentElement.lang = lng === "vi-VN" ? "vi" : "en";
  }
});

/**
 * Programmatic helper to set the app language smoothly without reloading
 */
export const changeAppLanguage = async (newLang: "vi-VN" | "en-US" | string) => {
  if (newLang !== "vi-VN" && newLang !== "en-US") return;
  await i18n.changeLanguage(newLang);
  if (typeof window !== "undefined") {
    try { localStorage.setItem("ui_lang", newLang); } catch { /* storage unavailable */ }
  }
};

if (typeof document !== "undefined") document.documentElement.lang = i18n.language === "vi-VN" ? "vi" : "en";

export default i18n;
