"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Locale } from "../lib/i18n";
import { defaultLocale } from "../lib/i18n";

const STORAGE_KEY = "orgflow-locale";
const COOKIE_NAME = "orgflow-locale";

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
} | null>(null);

type Props = {
  children: React.ReactNode;
  /** From server: cookie or Accept-Language (see resolveLocale). */
  initialLocale?: Locale;
};

export function LocaleProvider({ children, initialLocale = defaultLocale }: Props) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored === "en" || stored === "de") {
        setLocaleState(stored);
        document.cookie = `${COOKIE_NAME}=${stored}; path=/; max-age=31536000; SameSite=Lax`;
      } else {
        document.cookie = `${COOKIE_NAME}=${initialLocale}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, [initialLocale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      document.cookie = `${COOKIE_NAME}=${l}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // ignore
    }
  };

  const effective = mounted ? locale : initialLocale;

  return (
    <LocaleContext.Provider value={{ locale: effective, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  return ctx ?? { locale: defaultLocale as Locale, setLocale: () => {} };
}
