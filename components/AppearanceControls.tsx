"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useLocale } from "./LocaleProvider";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

function pill(active: boolean) {
  return `ui-pill text-xs ${active ? "" : ""}`;
}

export default function AppearanceControls({
  showSectionLabels = true,
  className = "",
}: {
  showSectionLabels?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { locale, setLocale } = useLocale();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const effectiveTheme = useMemo(() => {
    if (!mounted) return "system";
    return (theme ?? "system") as "light" | "dark" | "system";
  }, [mounted, theme]);

  const activeResolved = mounted ? (resolvedTheme ?? "light") : "light";

  function switchLocale(next: Locale) {
    setLocale(next);
    router.refresh();
  }

  return (
    <div className={className}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          {showSectionLabels ? <div className="section-label">{t("settings.appearance", locale)}</div> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={pill(effectiveTheme === "light")} onClick={() => setTheme("light")}>
              {locale === "en" ? "Light" : "Hell"}
            </button>
            <button type="button" className={pill(effectiveTheme === "dark")} onClick={() => setTheme("dark")}>
              {locale === "en" ? "Dark" : "Dunkel"}
            </button>
            <button type="button" className={pill(effectiveTheme === "system")} onClick={() => setTheme("system")}>
              {locale === "en" ? "System" : "System"}
            </button>
          </div>
          <div className="mt-2 text-xs text-[var(--ink-3)] dark:text-white/45">
            {locale === "en"
              ? `Currently: ${activeResolved}`
              : `Aktiv: ${activeResolved === "dark" ? "dunkel" : "hell"}`}
          </div>
        </div>

        <div>
          {showSectionLabels ? <div className="section-label">{locale === "en" ? "Language" : "Sprache"}</div> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={pill(locale === "de")} onClick={() => switchLocale("de")}>
              Deutsch
            </button>
            <button type="button" className={pill(locale === "en")} onClick={() => switchLocale("en")}>
              English
            </button>
          </div>
          <div className="mt-2 text-xs text-[var(--ink-3)] dark:text-white/45">{t("settings.language_note", locale)}</div>
        </div>
      </div>
    </div>
  );
}

