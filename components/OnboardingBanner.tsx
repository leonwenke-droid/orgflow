"use client";

import { useState, useEffect } from "react";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";
import { X } from "lucide-react";

const STORAGE_KEY = "orgflow-onboarding-banner-dismissed";

export default function OnboardingBanner() {
  const { locale } = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      // ignore
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
      setVisible(false);
    } catch {
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="relative rounded-xl border border-[var(--color-brand)]/25 bg-[var(--bg-brand-subtle)] px-4 py-3 pr-10">
      <p className="text-sm text-[var(--color-brand-text)]">
        {t("onboarding.welcome", locale)}
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded p-1 text-blue-600 hover:bg-blue-200/50 dark:text-blue-300 dark:hover:bg-blue-800/50"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
