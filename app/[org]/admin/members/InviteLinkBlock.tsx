"use client";

import { useState } from "react";
import { Link2, Copy, Check, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { copyTextToClipboard } from "../../../../lib/clipboard";

export default function InviteLinkBlock({ orgSlug }: { orgSlug: string }) {
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const createLink = async () => {
    setLoading(true);
    setInviteUrl(null);
    try {
      const res = await fetch("/api/invite-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug, expiresInDays: 7 }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setInviteUrl(data.url);
      }
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!inviteUrl) return;
    const ok = await copyTextToClipboard(inviteUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-primary p-4 shadow-sm dark:border-border-default bg-card">
      <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary">Invite link</h2>
      <p className="mt-1 text-xs text-text-secondary dark:text-text-muted">
        Create a link to invite members. Share it via email or messaging.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={createLink}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Link2 className="h-3.5 w-3.5" />
          {loading ? "Creating…" : "Create invite link"}
        </button>
        {inviteUrl && (
          <>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-secondary dark:border-border-default dark:text-text-secondary dark:hover:bg-bg-primary"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              className="inline-flex items-center gap-1.5 rounded border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-secondary dark:border-border-default dark:text-text-secondary dark:hover:bg-bg-primary"
            >
              <QrCode className="h-3.5 w-3.5" />
              {showQr ? "Hide QR" : "Show QR"}
            </button>
          </>
        )}
      </div>
      {inviteUrl && (
        <>
          <p className="mt-2 max-w-full truncate font-mono text-xs text-text-secondary dark:text-text-muted">
            {inviteUrl}
          </p>
          {showQr && (
            <div className="mt-3 flex flex-col items-center rounded-lg border border-border-subtle bg-bg-primary p-4 dark:border-border-default dark:bg-bg-primary">
              <QRCodeSVG value={inviteUrl} size={160} level="M" />
              <p className="mt-2 text-center text-xs text-text-secondary dark:text-text-muted">Scan to join</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
