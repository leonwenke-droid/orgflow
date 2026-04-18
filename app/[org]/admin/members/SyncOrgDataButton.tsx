"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncOrgDataAction } from "./actions";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";

export default function SyncOrgDataButton({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const { locale } = useLocale();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setMessage(null);
    const result = await syncOrgDataAction(orgSlug);
    setLoading(false);
    if (result.errorKey) {
      setMessage(t(result.errorKey, locale));
      return;
    }
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage(
      result.updated != null && result.updated > 0
        ? `${result.updated} members and scores assigned.`
        : "Sync complete. If still 0: profiles may already belong to another organisation."
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
        {loading ? "Assigning…" : "Assign members & scores"}
      </button>
      {message && (
        <span className={message.startsWith("Sync nur") || message.includes("Berechtigung") ? "text-amber-400" : "text-green-400"}>
          {message}
        </span>
      )}
    </div>
  );
}
