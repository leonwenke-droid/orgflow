"use client";

import { useState } from "react";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";
import { copyTextToClipboard } from "../lib/clipboard";

type Props = { token: string };

export default function CopyTaskLinkButton({ token }: Props) {
  const [copied, setCopied] = useState(false);
  const { locale } = useLocale();

  const handleClick = async () => {
    try {
      const fullUrl = typeof window !== "undefined" ? `${window.location.origin}/task/${token}` : "";
      const ok = await copyTextToClipboard(fullUrl);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded border border-border-default bg-bg-secondary px-2 py-0.5 text-text-primary hover:bg-bg-tertiary dark:border-border-default dark:bg-bg-primary dark:text-text-primary dark:hover:bg-bg-tertiary"
      title={t("tasks.copy_link", locale)}
    >
      {copied ? t("tasks.copied", locale) : t("tasks.copy_link", locale)}
    </button>
  );
}
