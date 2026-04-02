"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeScoreImport } from "./actions";
import { useLocale } from "../../../../../components/LocaleProvider";
import { t } from "../../../../../lib/i18n";
import { formatLocaleDateTime } from "../../../../../lib/formatDate";
import { Button } from "../../../../../components/ui/Button";

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

  return (
    <section className="mt-10 rounded-lg border border-border-subtle bg-bg-primary p-6 shadow-sm dark:border-border-default bg-card">
      <h2 className="mb-3 text-sm font-semibold text-text-primary dark:text-text-primary">
        {t("engagement.log_title", locale)}
      </h2>
      {error && (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <p className="mb-4 text-xs text-text-secondary dark:text-text-muted">
        When, how many points, to whom, reason and assigner.
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border-subtle text-left text-text-secondary dark:border-border-default dark:text-text-muted">
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
              <tr key={e.id} className="border-b border-border-subtle text-text-secondary">
                <td className="whitespace-nowrap py-2.5 pr-4 text-text-secondary">
                  {formatLocaleDateTime(e.created_at, locale)}
                </td>
                <td className="py-2.5 pr-4">{e.recipientName}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums font-medium">
                  {e.points > 0 ? `+${e.points}` : e.points}
                </td>
                <td className="py-2.5 pr-4 max-w-[200px] truncate" title={e.reason}>
                  {e.reason}
                </td>
                <td className="py-2.5 text-text-secondary">{e.createdBy}</td>
                <td className="py-2.5 text-right">
                  {e.canRemove ? (
                    <form action={handleRemove} className="inline">
                      <input type="hidden" name="logId" value={e.id} />
                      <Button
                        type="submit"
                        variant="destructive"
                        size="sm"
                        disabled={removingId === e.id}
                        className="px-2 py-1 text-[10px] font-normal"
                        title={t("engagement.remove_points", locale)}
                      >
                        {removingId === e.id ? "…" : t("common.remove", locale)}
                      </Button>
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
