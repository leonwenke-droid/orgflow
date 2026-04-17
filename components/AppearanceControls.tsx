"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useLocale } from "./LocaleProvider";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { updateOrganizationCurrencyAction } from "../app/[org]/settings/actions";
import { DEFAULT_CURRENCY } from "../lib/currency";

const COMMON_CURRENCY_CODES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "AUD",
  "NZD",
  "CAD",
  "JPY",
  "CNY",
  "INR",
  "BRL",
  "MXN",
  "ZAR"
] as const;

function pill(active: boolean) {
  return `ui-pill text-xs ${active ? "" : ""}`;
}

export default function AppearanceControls({
  showSectionLabels = true,
  className = "",
  orgCurrencyEditor
}: {
  showSectionLabels?: boolean;
  className?: string;
  /** Org settings only: ISO 4217 currency for treasury display. */
  orgCurrencyEditor?: { orgSlug: string; initialCurrency: string };
}) {
  const router = useRouter();
  const { locale, setLocale } = useLocale();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currencyInput, setCurrencyInput] = useState(orgCurrencyEditor?.initialCurrency ?? DEFAULT_CURRENCY);
  const [currencyNote, setCurrencyNote] = useState<string | null>(null);
  const [currencyPending, startCurrencyTransition] = useTransition();
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!orgCurrencyEditor) return;
    setCurrencyInput(orgCurrencyEditor.initialCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when server passes new slug/currency after refresh
  }, [orgCurrencyEditor?.initialCurrency, orgCurrencyEditor?.orgSlug]);

  const effectiveTheme = useMemo(() => {
    if (!mounted) return "system";
    return (theme ?? "system") as "light" | "dark" | "system";
  }, [mounted, theme]);

  const activeResolved = mounted ? (resolvedTheme ?? "light") : "light";

  function switchLocale(next: Locale) {
    setLocale(next);
    router.refresh();
  }

  function saveCurrency() {
    if (!orgCurrencyEditor) return;
    setCurrencyNote(null);
    startCurrencyTransition(async () => {
      const res = await updateOrganizationCurrencyAction(orgCurrencyEditor.orgSlug, currencyInput);
      if (res.error) {
        setCurrencyNote(res.error);
        return;
      }
      setCurrencyNote(t("settings.currency_saved", locale));
      router.refresh();
    });
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
          <div className="mt-2 text-xs text-text-muted">
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
          <div className="mt-2 text-xs text-text-muted">{t("settings.language_note", locale)}</div>
        </div>
      </div>

      {orgCurrencyEditor ? (
        <div className="mt-4 border-t border-border-subtle pt-4">
          {showSectionLabels ? (
            <div className="section-label">{t("settings.currency_section", locale)}</div>
          ) : null}
          <label className="mt-2 block text-xs text-text-muted" htmlFor="org-currency-input">
            {t("settings.currency_label", locale)}
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              id="org-currency-input"
              list="org-currency-datalist"
              maxLength={3}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              value={currencyInput}
              onChange={(e) => setCurrencyInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))}
              className="auth-input max-w-[7rem] font-mono text-sm uppercase"
            />
            <datalist id="org-currency-datalist">
              {COMMON_CURRENCY_CODES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={currencyPending || currencyInput.length !== 3}
              onClick={saveCurrency}
            >
              {locale === "en" ? "Save" : "Speichern"}
            </button>
          </div>
          <p className="mt-2 text-xs text-text-muted">{t("settings.currency_note", locale)}</p>
          {currencyNote ? (
            <p className="mt-1 text-xs text-text-secondary" role="status">
              {currencyNote}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

