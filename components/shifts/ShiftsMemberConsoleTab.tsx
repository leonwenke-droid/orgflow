"use client";

import Link from "next/link";
import { useLocale } from "../LocaleProvider";
import { t } from "../../lib/i18n";

export default function ShiftsMemberConsoleTab({ orgSlug }: { orgSlug: string | null }) {
  const { locale } = useLocale();
  const href = orgSlug ? `/${encodeURIComponent(orgSlug)}/shifts` : "/";

  return (
    <div className="sc-card">
      <div className="sc-card-hd">{t("shifts.console_tab_member", locale)}</div>
      <div className="p-5 text-sm leading-relaxed" style={{ color: "var(--sc-text2)" }}>
        <p className="mb-4">{t("shifts.console_member_intro", locale)}</p>
        <Link
          href={href}
          className="sc-btn sc-btn-primary inline-flex min-h-[44px] items-center justify-center px-5 no-underline"
        >
          {t("shifts.console_member_open", locale)}
        </Link>
      </div>
    </div>
  );
}
