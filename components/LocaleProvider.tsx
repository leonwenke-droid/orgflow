"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Locale } from "../lib/i18n";

const STORAGE_KEY = "orgflow-locale";
const COOKIE_NAME = "orgflow-locale";

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
} | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored === "en" || stored === "de") {
        setLocaleState(stored);
        document.cookie = `${COOKIE_NAME}=${stored}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      document.cookie = `${COOKIE_NAME}=${l}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // ignore
    }
  };

  return (
    <LocaleContext.Provider value={{ locale: mounted ? locale : "en", setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  return ctx ?? { locale: "en" as Locale, setLocale: () => {} };
}
