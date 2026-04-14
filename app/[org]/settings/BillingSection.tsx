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
  const [compareOpen, setCompareOpen] = useState(false);
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
        ? "Pro (ab 50 Mitgl.)"
        : "Pro (50+ members)"
      : currentPlan === "team"
        ? locale === "de"
          ? "Team (bis 49 Mitgl.)"
          : "Team (up to 49 members)"
        : locale === "de"
          ? "Starter (Free)"
          : "Starter (Free)";

  const useScaleTier = memberCount >= PAID_TIER_SCALE_MEMBER_THRESHOLD;
  const limits = getPlanLimits((currentPlan as any) ?? "free");
  const memberLimitLabel = limits.members === Infinity ? "∞" : String(limits.members);
  const overLimit = limits.members !== Infinity && memberCount > limits.members;
  const recommendedUpgrade =
    currentPlan === "pro"
      ? null
      : useScaleTier
        ? "pro"
        : "team";
  const recommendedUpgradeLabel =
    recommendedUpgrade === "pro"
      ? locale === "de"
        ? "Upgrade: Pro (ab 50 Mitgl.)"
        : "Upgrade: Pro (50+ members)"
      : recommendedUpgrade === "team"
        ? locale === "de"
          ? "Upgrade: Team (bis 49 Mitgl.)"
          : "Upgrade: Team (up to 49 members)"
        : null;

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
            onClick={() => setCompareOpen(true)}
            className="rounded-lg border border-border-default px-3 py-2 text-xs font-semibold text-text-primary hover:bg-bg-secondary dark:border-border-default dark:text-text-primary dark:hover:bg-bg-primary"
          >
            {locale === "de" ? "Plan ändern" : "Change plan"}
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

        {recommendedUpgrade && recommendedUpgradeLabel ? (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => startCheckout()}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (locale === "de" ? "Weiter…" : "Redirecting…") : recommendedUpgradeLabel}
            </button>
            <p className="text-[11px] text-text-secondary dark:text-text-muted">
              {locale === "de"
                ? "Du siehst hier nur den nächst passenden Plan basierend auf eurer Mitgliederzahl."
                : "Only the next relevant plan is shown based on your member count."}
            </p>
          </div>
        ) : null}
      </div>

      {compareOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setCompareOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-border-subtle bg-bg-primary p-4 shadow-xl dark:border-border-default dark:bg-bg-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-text-primary dark:text-text-primary">
                  {locale === "de" ? "Pläne vergleichen" : "Compare plans"}
                </h3>
                <p className="mt-1 text-xs text-text-secondary dark:text-text-muted">
                  {locale === "de"
                    ? "Wähle den Plan, der zu eurer Mitgliederzahl passt."
                    : "Choose the plan that matches your member count."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompareOpen(false)}
                className="rounded-lg border border-border-default px-2 py-1 text-xs font-semibold text-text-primary hover:bg-bg-secondary dark:border-border-default dark:hover:bg-bg-primary"
              >
                {locale === "de" ? "Schließen" : "Close"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <PlanCard
                locale={locale}
                title={locale === "de" ? "Starter" : "Starter"}
                subtitle={locale === "de" ? "0 € · bis 5 Mitglieder" : "€0 · up to 5 members"}
                active={currentPlan !== "team" && currentPlan !== "pro"}
                features={
                  locale === "de"
                    ? ["Aufgaben & Schichten", "1 Team · bis 5 Mitglieder", "Keine Finanzen", "Kein Engagement"]
                    : ["Tasks & shifts", "1 team · up to 5 members", "No finance", "No engagement"]
                }
              />
              <PlanCard
                locale={locale}
                title={locale === "de" ? "Team" : "Team"}
                subtitle={locale === "de" ? "29 € · bis 49 Mitglieder" : "€29 · up to 49 members"}
                active={currentPlan === "team"}
                actionLabel={locale === "de" ? "Upgrade auf Team" : "Upgrade to Team"}
                disabled={Boolean(currentPlan === "pro")}
                loading={loading}
                onAction={() => startCheckout()}
                features={
                  locale === "de"
                    ? ["Alle Starter-Features", "Finanzen & CSV-Export", "Engagement Score", "Bis 49 Mitglieder"]
                    : ["All Starter features", "Finance & CSV export", "Engagement score", "Up to 49 members"]
                }
              />
              <PlanCard
                locale={locale}
                title={locale === "de" ? "Pro" : "Pro"}
                subtitle={locale === "de" ? "49 € · ab 50 Mitglieder" : "€49 · 50+ members"}
                active={currentPlan === "pro"}
                actionLabel={locale === "de" ? "Upgrade auf Pro" : "Upgrade to Pro"}
                disabled={currentPlan === "pro" || (!useScaleTier && currentPlan !== "pro")}
                loading={loading}
                onAction={() => startCheckout()}
                features={
                  locale === "de"
                    ? ["Alle Team-Features", "Für große Teams (ab 50)", "Fester Preis (49 €)"]
                    : ["All Team features", "For larger teams (50+)", "Flat price (€49)"]
                }
                note={
                  !useScaleTier && currentPlan !== "pro"
                    ? locale === "de"
                      ? "Pro ist ab 50 Mitgliedern verfügbar."
                      : "Pro is available from 50 members."
                    : null
                }
              />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <div className="rounded-lg border border-border-subtle bg-bg-secondary p-3 text-xs text-text-secondary dark:border-border-default dark:bg-bg-primary/60 dark:text-text-muted">
                {locale === "de"
                  ? "Rechnungen, Zahlungsmethoden und Kündigung verwaltest du im Stripe-Portal."
                  : "Manage invoices, payment methods, and cancellations in the Stripe portal."}
              </div>
              <button
                type="button"
                onClick={() => openPortal()}
                disabled={portalLoading}
                className="w-fit rounded-lg border border-border-default px-3 py-2 text-xs font-semibold text-text-primary hover:bg-bg-secondary disabled:opacity-50 dark:border-border-default dark:text-text-primary dark:hover:bg-bg-primary"
              >
                {portalLoading ? (locale === "de" ? "Weiter…" : "Opening…") : (locale === "de" ? "Stripe-Portal öffnen" : "Open Stripe portal")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function PlanCard(props: {
  locale: "de" | "en";
  title: string;
  subtitle: string;
  active: boolean;
  actionLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  onAction?: () => void;
  note?: string | null;
  features?: string[];
}) {
  const { locale, title, subtitle, active, actionLabel, disabled, loading, onAction, note, features } = props;
  return (
    <div className={`rounded-xl border p-3 ${active ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30" : "border-border-subtle bg-bg-primary dark:border-border-default dark:bg-bg-primary"}`}>
      <div className="text-sm font-semibold text-text-primary dark:text-text-primary">{title}</div>
      <div className="mt-1 text-xs text-text-secondary dark:text-text-muted">{subtitle}</div>
      {features && features.length > 0 ? (
        <ul className="mt-3 space-y-1 text-[11px] text-text-secondary dark:text-text-muted">
          {features.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="mt-[2px] inline-block h-1.5 w-1.5 rounded-full bg-text-secondary/60 dark:bg-text-muted/60" />
              <span className="min-w-0">{f}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          disabled={disabled || loading}
          className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "…" : actionLabel}
        </button>
      ) : (
        <div className="mt-3 w-full rounded-lg border border-border-default px-3 py-2 text-center text-xs font-semibold text-text-secondary dark:border-border-default dark:text-text-muted">
          {active ? (locale === "de" ? "Aktuell" : "Current") : "—"}
        </div>
      )}
      {note ? <div className="mt-2 text-[11px] text-text-secondary dark:text-text-muted">{note}</div> : null}
    </div>
  );
}

