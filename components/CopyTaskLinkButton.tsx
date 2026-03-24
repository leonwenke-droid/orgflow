"use client";

import { useState } from "react";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

type Props = { token: string };

export default function CopyTaskLinkButton({ token }: Props) {
  const [copied, setCopied] = useState(false);
  const { locale } = useLocale();

  const handleClick = async () => {
    try {
      const fullUrl = typeof window !== "undefined" ? `${window.location.origin}/task/${token}` : "";
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded border border-gray-300 bg-slate-100 px-2 py-0.5 text-slate-800 hover:bg-slate-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
      title={t("tasks.copy_link", locale)}
    >
      {copied ? t("tasks.copied", locale) : t("tasks.copy_link", locale)}
    </button>
  );
}
