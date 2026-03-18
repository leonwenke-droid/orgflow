"use client";

import { useEffect, useState } from "react";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

const STORAGE_KEY = "orgflow-cookie-notice-ack";

export default function CookieNotice() {
  const { locale } = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const ack = localStorage.getItem(STORAGE_KEY);
      if (!ack) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 mx-auto w-[calc(100%-2rem)] max-w-xl rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-card-dark">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t("cookies.notice_title", locale)}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {t("cookies.notice_text", locale)}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          onClick={() => {
            try {
              localStorage.setItem(STORAGE_KEY, "1");
            } catch {
              // ignore
            }
            setVisible(false);
          }}
        >
          {t("cookies.accept", locale)}
        </button>
      </div>
    </div>
  );
}

