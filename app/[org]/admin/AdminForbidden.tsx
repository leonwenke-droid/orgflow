"use client";

import Link from "next/link";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";

export default function AdminForbidden({
  orgSlug,
  orgName
}: {
  orgSlug: string;
  orgName: string;
}) {
  const { locale } = useLocale();
  const message = t("admin.forbidden_message", locale).replace("{orgName}", orgName);
  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-bold text-text-primary dark:text-foreground-dark">
        {t("admin.forbidden_title", locale)}
      </h1>
      <p className="mt-3 text-sm text-text-secondary dark:text-muted">
        {message}
      </p>
      <Link
        href={`/${orgSlug}/dashboard`}
        className="mt-6 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        {t("admin.back_to_dashboard", locale)}
      </Link>
    </div>
  );
}
