"use client";

import { useState } from "react";
import { regenerateSetupTokenAction } from "./actions";
import { useLocale } from "../../components/LocaleProvider";
import { t } from "../../lib/i18n";
import { copyTextToClipboard } from "../../lib/clipboard";

type Org = {
  id: string;
  name: string;
  slug: string;
  setup_token?: string | null;
  setup_token_used_at?: string | null;
};

export default function SetupLinkBlock({
  org,
  initialLink,
}: {
  org: Org;
  initialLink: string | null;
}) {
  const { locale } = useLocale();
  const [link, setLink] = useState<string | null>(initialLink);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canRegenerate = org.setup_token && !org.setup_token_used_at;

  async function handleRegenerate() {
    if (!canRegenerate) return;
    setLoading(true);
    setError(null);
    const result = await regenerateSetupTokenAction(org.id);
    setLoading(false);
    if (result.errorKey) {
      setError(t(result.errorKey, locale));
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.token && result.slug && typeof window !== "undefined") {
      const newLink = `${window.location.origin}/claim-org?token=${encodeURIComponent(result.token)}`;
      setLink(newLink);
    }
  }

  async function handleCopy() {
    const displayLink = link ?? initialLink;
    if (!displayLink) return;
    const ok = await copyTextToClipboard(displayLink);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!canRegenerate && !link) return null;

  const displayLink = link ?? initialLink;

  return (
    <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs">
      <p className="mb-1 font-medium text-blue-200">Einrichtungs-Link (noch nicht genutzt)</p>
      <p className="mb-2 text-blue-400/90">Dieser Link erscheint hier nach dem Anlegen der Organisation bzw. nach „Token neu generieren“. Zum Verschicken kopieren.</p>
      {displayLink && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 break-all font-mono text-blue-300">{displayLink}</p>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700"
          >
            {copied ? "Kopiert" : "Kopieren"}
          </button>
        </div>
      )}
      {canRegenerate && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={loading}
            className="rounded bg-amber-600/80 px-2 py-1 text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {loading ? "…" : "Token neu generieren"}
          </button>
          {error && <span className="text-red-400">{error}</span>}
        </div>
      )}
    </div>
  );
}
