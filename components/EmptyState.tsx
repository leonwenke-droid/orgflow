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
              className="btn-primary"
            >
              {actionLabel}
            </Link>
          )}
          {secondaryActionHref && secondaryLabel && (
            <Link
              href={secondaryActionHref}
              className="btn-secondary"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
