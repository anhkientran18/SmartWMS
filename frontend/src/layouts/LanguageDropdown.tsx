import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { ChevronDown, Check } from "lucide-react";

interface LanguageDropdownProps {
  currentLang: string;
  onChangeLang: (lang: string) => void;
  variant?: "dark" | "light";
}

const supportedLanguages = [
  { code: "vi-VN", short: "VN", name: "Tiếng Việt" },
  { code: "en-US", short: "EN", name: "English" },
];

export default function LanguageDropdown({
  currentLang,
  onChangeLang,
  variant = "light",
}: LanguageDropdownProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const currentLangData =
    supportedLanguages.find((l) => l.code === currentLang) ||
    supportedLanguages[0];

  const isDark = variant === "dark";

  return (
    <div className="relative z-50" onKeyDown={e => { if (e.key === "Escape") setIsOpen(false); }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={
          isDark
            ? "h-8 px-2.5 text-xs rounded-lg border border-slate-700 bg-slate-800 text-slate-200 flex items-center gap-1.5 hover:bg-slate-700 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer shadow-xs"
            : "h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500/20 cursor-pointer shadow-xs"
        }
        title={t("ui.chooseLanguage")}
        aria-label={`${t("ui.chooseLanguage")}: ${currentLangData.name}`}
        aria-expanded={isOpen}
      >
        <span aria-hidden="true" className="text-[10px] font-mono text-slate-400">{currentLangData.short}</span>
        <span className="text-xs font-semibold">{currentLangData.name}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={`absolute right-0 mt-1.5 w-44 ${
              isDark
                ? "bg-slate-800 border-slate-700 text-slate-200 shadow-slate-900/60"
                : "bg-white border-slate-200 text-slate-800 shadow-lg"
            } border rounded-lg z-50 py-1 animate-fadeIn origin-top-right text-xs`}
          >
            {supportedLanguages.map((lang) => {
              const isSelected = currentLang === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    onChangeLang(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors cursor-pointer ${
                    isDark
                      ? isSelected
                        ? "bg-slate-700 text-blue-400 font-semibold"
                        : "hover:bg-slate-700/60 text-slate-300"
                      : isSelected
                      ? "bg-blue-50/70 text-blue-600 font-semibold"
                      : "hover:bg-slate-50 text-slate-700 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{lang.name}</span>
                    <span aria-hidden="true" className="text-[10px] font-mono text-slate-400 uppercase">
                      ({lang.short})
                    </span>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" strokeWidth={2.5} />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
