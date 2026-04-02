"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import type { Locale } from "../lib/i18n";

export default function LanguageToggle() {
  const router = useRouter();
  const { locale, setLocale } = useLocale();

  const switchTo = (newLocale: Locale) => {
    setLocale(newLocale);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => switchTo("en")}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
          locale === "en"
            ? "bg-[var(--bg-brand-subtle)] text-[var(--color-brand-text)]"
            : "text-text-secondary hover:bg-bg-secondary dark:text-text-muted dark:hover:bg-bg-primary"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => switchTo("de")}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
          locale === "de"
            ? "bg-[var(--bg-brand-subtle)] text-[var(--color-brand-text)]"
            : "text-text-secondary hover:bg-bg-secondary dark:text-text-muted dark:hover:bg-bg-primary"
        }`}
      >
        DE
      </button>
    </div>
  );
}
