"use client";

import { useState } from "react";
import { useLocale } from "../../../components/LocaleProvider";

export default function BillingSection({
  orgSlug,
  currentPlan
}: {
  orgSlug: string;
  currentPlan: string | null | undefined;
}) {
  const { locale } = useLocale();
  const [loading, setLoading] = useState<null | "team" | "pro">(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(plan: "team" | "pro") {
    setLoading(plan);
    setError(null);
    try {
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug, plan })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Billing request failed.");
        setLoading(null);
        return;
      }
      const url = String(data.url ?? "");
      if (!url) {
        setError("No checkout URL returned.");
        setLoading(null);
        return;
      }
      window.location.href = url;
    } catch {
      setError(locale === "de" ? "Netzwerkfehler." : "Network error.");
      setLoading(null);
    }
  }

  const planLabel =
    currentPlan === "pro"
      ? locale === "de"
        ? "Enterprise"
        : "Enterprise"
      : currentPlan === "team"
        ? locale === "de"
          ? "Pro"
          : "Pro"
        : locale === "de"
          ? "Starter (Free)"
          : "Starter (Free)";

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {locale === "de" ? "Aktueller Plan" : "Current plan"}: {planLabel}
      </p>
      <p className="text-xs text-gray-500 dark:text-muted">
        {locale === "de"
          ? "Upgrade per Stripe Checkout. Planlimits werden serverseitig erzwungen. Pro beinhaltet eine 2-wöchige kostenlose Testphase."
          : "Upgrade via Stripe Checkout. Plan limits are enforced server-side. Pro includes a 2-week free trial."}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => startCheckout("team")}
          disabled={loading !== null}
          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {loading === "team"
            ? locale === "de"
              ? "Weiter…"
              : "Redirecting…"
            : locale === "de"
              ? "Upgrade: Pro (bis 50 Mitglieder)"
              : "Upgrade: Pro (up to 50 members)"}
        </button>
        <button
          type="button"
          onClick={() => startCheckout("pro")}
          disabled={loading !== null}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading === "pro"
            ? locale === "de"
              ? "Weiter…"
              : "Redirecting…"
            : locale === "de"
              ? "Upgrade: Enterprise (unbegrenzt)"
              : "Upgrade: Enterprise (unlimited)"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        {locale === "de"
          ? "Hinweis: Webhook-URL ist `/api/billing/stripe-webhook`."
          : "Note: webhook endpoint is `/api/billing/stripe-webhook`."}
      </p>
    </div>
  );
}

