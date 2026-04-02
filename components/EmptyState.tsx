"use client";

import Link from "next/link";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

type Props = {
  messageKey: string;
  actionHref?: string;
  actionLabelKey?: string;
  secondaryActionHref?: string;
  secondaryActionLabelKey?: string;
  /** "admin" shows CTAs; "member" hides actions and uses passive copy. */
  variant?: "admin" | "member";
  /** Optional icon displayed above the message (React node or emoji string). */
  icon?: React.ReactNode;
  className?: string;
};

export default function EmptyState({
  messageKey,
  actionHref,
  actionLabelKey,
  secondaryActionHref,
  secondaryActionLabelKey,
  variant = "admin",
  icon,
  className = ""
}: Props) {
  const { locale } = useLocale();
  const message = t(messageKey, locale);
  const actionLabel = actionLabelKey ? t(actionLabelKey, locale) : null;
  const secondaryLabel =
    secondaryActionLabelKey && secondaryActionHref ? t(secondaryActionLabelKey, locale) : null;

  const showActions = variant !== "member";

  return (
    <div
      className={`rounded-[var(--radius-modal)] border border-dashed border-border-default bg-bg-secondary/70 py-8 text-center text-text-primary dark:border-border-subtle dark:bg-bg-primary/8 ${className}`}
    >
      {icon ? <div className="mb-3 text-3xl">{icon}</div> : null}
      <p className="mx-auto max-w-sm text-sm text-text-secondary">{message}</p>
      {showActions && ((actionHref && actionLabel) || (secondaryActionHref && secondaryLabel)) ? (
        <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row sm:flex-wrap">
          {actionHref && actionLabel && (
            <Link href={actionHref} className="btn-primary">
              {actionLabel}
            </Link>
          )}
          {secondaryActionHref && secondaryLabel && (
            <Link href={secondaryActionHref} className="btn-secondary">
              {secondaryLabel}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
