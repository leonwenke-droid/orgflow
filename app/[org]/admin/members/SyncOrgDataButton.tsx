"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncOrgDataAction } from "./actions";

export default function SyncOrgDataButton({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setMessage(null);
    const result = await syncOrgDataAction(orgSlug);
    setLoading(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(
      result.updated != null && result.updated > 0
        ? `${result.updated} Mitglieder und Scores zugewiesen.`
        : "Sync durchgeführt. Falls weiterhin 0: Profile haben bereits eine andere Organisation."
    );
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {loading ? "Wird zugewiesen…" : "Mitglieder & Scores aus DB zuweisen"}
      </button>
      {message && (
        <span className={message.startsWith("Sync nur") || message.includes("Berechtigung") ? "text-amber-400" : "text-green-400"}>
          {message}
        </span>
      )}
    </div>
  );
}
