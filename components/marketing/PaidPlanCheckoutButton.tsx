"use client";

import { useState } from "react";

type Tier = "base" | "scale";

export default function PaidPlanCheckoutButton({
  tier,
  className,
  style,
  children,
}: {
  tier: Tier;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/create-checkout-session-new-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (res.status === 401) {
        window.location.href = `/login?redirectTo=${encodeURIComponent(`/create-organisation?tier=${tier}`)}`;
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok) {
        setLoading(false);
        setError(data.message || "Checkout konnte nicht gestartet werden.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setLoading(false);
      setError("Keine Checkout-URL erhalten.");
    } catch {
      setLoading(false);
      setError("Netzwerkfehler.");
    }
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={start} className={className} style={style} disabled={loading}>
        {loading ? "Weiterleitung…" : children}
      </button>
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

