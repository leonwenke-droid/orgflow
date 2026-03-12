"use client";

import { useState } from "react";
import { Link2, Copy, Check } from "lucide-react";

export default function InviteLinkBlock({ orgSlug }: { orgSlug: string }) {
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const copyLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Invite link</h2>
      <p className="mt-1 text-xs text-gray-600">
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
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        )}
      </div>
      {inviteUrl && (
        <p className="mt-2 max-w-full truncate font-mono text-xs text-gray-500">
          {inviteUrl}
        </p>
      )}
    </div>
  );
}
