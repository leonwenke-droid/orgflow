"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeScoreImport } from "./actions";
import { useLocale } from "../../../../../components/LocaleProvider";
import { t } from "../../../../../lib/i18n";

type LogEntry = {
  id: string;
  user_id: string;
  recipientName: string;
  points: number;
  reason: string;
  created_at: string;
  createdBy: string;
  canRemove?: boolean;
};

export default function ScoreImportLog({ entries, orgSlug }: { entries: LogEntry[]; orgSlug: string }) {
  const { locale } = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleRemove(formData: FormData) {
    const logId = formData.get("logId")?.toString();
    if (!logId) return;
    setError(null);
    setRemovingId(logId);
    const result = await removeScoreImport(orgSlug, logId);
    setRemovingId(null);
    if ("errorKey" in result && result.errorKey) {
      setError(t(result.errorKey, locale));
    } else if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  if (entries.length === 0) return null;

  function formatDate(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "–";
    }
  }

  return (
    <section className="mt-10 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
      <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {t("engagement.log_title", locale)}
      </h2>
      {error && (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <p className="mb-4 text-xs text-gray-600 dark:text-gray-400">
        When, how many points, to whom, reason and assigner.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th className="py-2 pr-4 font-medium">{t("engagement.date_time", locale)}</th>
              <th className="py-2 pr-4 font-medium">{t("engagement.recipient", locale)}</th>
              <th className="py-2 pr-4 font-medium text-right">{t("engagement.points_column", locale)}</th>
              <th className="py-2 pr-4 font-medium">{t("engagement.reason", locale)}</th>
              <th className="py-2 pr-4 font-medium">{t("engagement.assigner", locale)}</th>
              <th className="py-2 w-16 text-right font-medium">{t("engagement.action", locale)}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-gray-100 text-gray-700">
                <td className="whitespace-nowrap py-2.5 pr-4 text-gray-600">
                  {formatDate(e.created_at)}
                </td>
                <td className="py-2.5 pr-4">{e.recipientName}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums font-medium">
                  {e.points > 0 ? `+${e.points}` : e.points}
                </td>
                <td className="py-2.5 pr-4 max-w-[200px] truncate" title={e.reason}>
                  {e.reason}
                </td>
                <td className="py-2.5 text-gray-600">{e.createdBy}</td>
                <td className="py-2.5 text-right">
                  {e.canRemove ? (
                    <form action={handleRemove} className="inline">
                      <input type="hidden" name="logId" value={e.id} />
                      <button
                        type="submit"
                        disabled={removingId === e.id}
                        className="rounded px-2 py-1 text-[10px] text-red-600 hover:bg-red-100 disabled:opacity-50"
                        title={t("engagement.remove_points", locale)}
                      >
                        {removingId === e.id ? "…" : t("common.remove", locale)}
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
