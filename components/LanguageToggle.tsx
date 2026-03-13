"use client";

import { useLocale } from "./LocaleProvider";
import type { Locale } from "../lib/i18n";

export default function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
          locale === "en"
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("de")}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
          locale === "de"
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        }`}
      >
        DE
      </button>
    </div>
  );
}
