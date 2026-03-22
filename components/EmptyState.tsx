"use client";

import Link from "next/link";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

type Props = {
  messageKey: string;
  actionHref?: string;
  /** Translation key for button (e.g. cta.create_task). Used when actionHref is set. */
  actionLabelKey?: string;
  /** Optional second action (e.g. member overview while primary opens admin). */
  secondaryActionHref?: string;
  secondaryActionLabelKey?: string;
  className?: string;
};

export default function EmptyState({
  messageKey,
  actionHref,
  actionLabelKey,
  secondaryActionHref,
  secondaryActionLabelKey,
  className = ""
}: Props) {
  const { locale } = useLocale();
  const message = t(messageKey, locale);
  const actionLabel = actionLabelKey ? t(actionLabelKey, locale) : null;
  const secondaryLabel =
    secondaryActionLabelKey && secondaryActionHref ? t(secondaryActionLabelKey, locale) : null;

  return (
    <div
      className={`rounded-xl border border-dashed border-gray-300 bg-gray-50/80 py-8 text-center dark:border-gray-600 dark:bg-gray-800/50 ${className}`}
    >
      <p className="mx-auto max-w-sm text-sm text-gray-600 dark:text-gray-400">{message}</p>
      {(actionHref && actionLabel) || (secondaryActionHref && secondaryLabel) ? (
        <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row sm:flex-wrap">
          {actionHref && actionLabel && (
            <Link
              href={actionHref}
              className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              {actionLabel}
            </Link>
          )}
          {secondaryActionHref && secondaryLabel && (
            <Link
              href={secondaryActionHref}
              className="inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
