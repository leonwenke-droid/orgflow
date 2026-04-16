"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";

export default function OnboardingQuickSetupModal({ orgSlug }: { orgSlug: string }) {
  const { locale } = useLocale();
  const storageKey = `orgflow:onboarding:quick-setup:${orgSlug}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) setOpen(true);
    } catch {
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-t-xl border border-border-subtle bg-bg-primary shadow-xl sm:rounded-xl dark:border-border-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3 dark:border-border-default">
          <div>
            <div className="text-sm font-semibold text-text-primary">{t("onboarding.setup_title", locale).replace("{name}", "")}</div>
            <div className="text-xs text-text-secondary">{locale === "de" ? "Schnellstart (optional)" : "Quick setup (optional)"}</div>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
            aria-label={t("common.close", locale)}
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-sm text-text-secondary">
            {locale === "de"
              ? "Möchtest du direkt starten? Lege Teams an und lade Mitglieder ein – oder überspringe das und mach es später im Admin-Bereich."
              : "Want to start right away? Create teams and invite members — or skip and do it later in the admin area."}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link href={`/${orgSlug}/admin/committees`} className="btn-secondary w-full text-center" onClick={close}>
              {locale === "de" ? "Teams anlegen" : "Create teams"}
            </Link>
            <Link href={`/${orgSlug}/admin/members`} className="btn-primary w-full text-center" onClick={close}>
              {locale === "de" ? "Mitglieder einladen" : "Invite members"}
            </Link>
          </div>

          <button type="button" className="w-full text-center text-xs text-text-muted hover:text-text-secondary" onClick={close}>
            {locale === "de" ? "Später" : "Later"}
          </button>
        </div>
      </div>
    </div>
  );
}

