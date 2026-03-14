"use client";

import Link from "next/link";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

type Props = {
  messageKey: string;
  actionHref?: string;
  /** Translation key for button (e.g. cta.create_task). Used when actionHref is set. */
  actionLabelKey?: string;
  className?: string;
};

export default function EmptyState({ messageKey, actionHref, actionLabelKey, className = "" }: Props) {
  const { locale } = useLocale();
  const message = t(messageKey, locale);
  const actionLabel = actionLabelKey ? t(actionLabelKey, locale) : null;

  return (
    <div
      className={`rounded-xl border border-dashed border-gray-300 bg-gray-50/80 py-8 text-center dark:border-gray-600 dark:bg-gray-800/50 ${className}`}
    >
      <p className="mx-auto max-w-sm text-sm text-gray-600 dark:text-gray-400">{message}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
