"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";
import { getPlanLimits, PAID_TIER_SCALE_MEMBER_THRESHOLD } from "../../../lib/planLimits";

export default function BillingSection({
  orgSlug,
  currentPlan,
  enterpriseMailto,
  memberCount
}: {
  orgSlug: string;
  currentPlan: string | null | undefined;
  /** mailto:… für Enterprise-Anfrage; sonst Link zur Kontaktseite */
  enterpriseMailto: string | null;
  /** Aktuelle Mitgliederzahl (für passenden Stripe-Preis) */
  memberCount: number;
}) {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug, plan: "team" })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Billing request failed.");
        setLoading(false);
        return;
      }
      const url = String(data.url ?? "");
      if (!url) {
        setError("No checkout URL returned.");
        setLoading(false);
        return;
      }
      window.location.href = url;
    } catch {
      setError(locale === "de" ? "Netzwerkfehler." : "Network error.");
      setLoading(false);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Portal request failed.");
        setPortalLoading(false);
        return;
      }
      const url = String(data.url ?? "");
      if (!url) {
        setError("No portal URL returned.");
        setPortalLoading(false);
        return;
      }
      window.location.href = url;
    } catch {
      setError(locale === "de" ? "Netzwerkfehler." : "Network error.");
      setPortalLoading(false);
    }
  }

  const planLabel =
    currentPlan === "pro"
      ? locale === "de"
        ? "50+ Mitglieder"
        : "50+ members"
      : currentPlan === "team"
        ? locale === "de"
          ? "Pro (bis 49 Mitgl.)"
          : "Pro (up to 49 members)"
        : locale === "de"
          ? "Starter (Free)"
          : "Starter (Free)";

  const useScaleTier = memberCount >= PAID_TIER_SCALE_MEMBER_THRESHOLD;
  const limits = getPlanLimits((currentPlan as any) ?? "free");
  const memberLimitLabel = limits.members === Infinity ? "∞" : String(limits.members);
  const overLimit = limits.members !== Infinity && memberCount > limits.members;

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-secondary dark:text-text-muted">{t("settings.billing_stripe_when_intro", locale)}</p>
      <p className="text-sm font-medium text-text-primary dark:text-text-primary">
        {locale === "de" ? "Aktueller Plan" : "Current plan"}: {planLabel}
      </p>
      <p className="text-xs text-text-secondary dark:text-text-muted">
        {locale === "de" ? "Mitglieder" : "Members"}: {memberCount} / {memberLimitLabel}
      </p>
      {overLimit ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {t("members.error_member_limit", locale)}
        </p>
      ) : null}
      <p className="text-xs text-text-secondary dark:text-text-muted">
        {t("settings.billing_two_tier_blurb", locale)}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => startCheckout()}
            disabled={loading}
            className="rounded-lg border border-border-default px-3 py-2 text-xs font-semibold text-text-primary hover:bg-bg-secondary disabled:opacity-50 dark:border-border-default dark:text-text-primary dark:hover:bg-bg-primary"
          >
            {loading
              ? locale === "de"
                ? "Weiter…"
                : "Redirecting…"
              : useScaleTier
                ? t("settings.billing_checkout_cta_scale", locale)
                : t("settings.billing_checkout_cta_base", locale)}
          </button>
          <button
            type="button"
            onClick={() => openPortal()}
            disabled={portalLoading}
            className="rounded-lg border border-border-default px-3 py-2 text-xs font-semibold text-text-primary hover:bg-bg-secondary disabled:opacity-50 dark:border-border-default dark:text-text-primary dark:hover:bg-bg-primary"
          >
            {portalLoading ? (locale === "de" ? "Weiter…" : "Opening…") : (locale === "de" ? "Abo & Rechnungen" : "Subscription & invoices")}
          </button>
        </div>
        <div className="flex max-w-md flex-col gap-1">
          <p className="text-[11px] text-text-secondary dark:text-text-muted">{t("settings.billing_enterprise_hint", locale)}</p>
          {enterpriseMailto ? (
            <a
              href={enterpriseMailto}
              className="inline-flex w-fit rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              {t("settings.billing_enterprise_cta", locale)}
            </a>
          ) : (
            <Link
              href="/contact"
              className="inline-flex w-fit rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              {t("settings.billing_enterprise_cta", locale)}
            </Link>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <p className="text-[11px] text-text-secondary dark:text-text-muted">{t("settings.billing_webhook_hint", locale)}</p>
    </div>
  );
}

