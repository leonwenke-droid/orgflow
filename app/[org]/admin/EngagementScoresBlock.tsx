"use client";

import { useState } from "react";
import Link from "next/link";
import { getEngagementScoresAction, type ScoreRow } from "./actions";
import { useLocale } from "../../../components/LocaleProvider";
import { t } from "../../../lib/i18n";

export default function EngagementScoresBlock({ orgSlug, currentAuthUserId = null }: { orgSlug: string; currentAuthUserId?: string | null }) {
  const { locale } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState<ScoreRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailsFor, setDetailsFor] = useState<ScoreRow | null>(null);

  async function loadScores() {
    if (scores !== null) {
      setExpanded(true);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await getEngagementScoresAction(orgSlug);
    setLoading(false);
    if (result.errorKey) {
      setError(t(result.errorKey, locale));
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    setScores(result.scores ?? []);
    setExpanded(true);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-card-dark">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-6 py-5 dark:border-gray-700">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("dashboard.engagement", locale)}</h2>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
            {!expanded && t("engagement.points_title", locale)}
            {expanded && scores !== null && `${scores.length} ${t("engagement.members_count", locale)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {expanded && scores !== null && (
            <Link
              href={`/${orgSlug}/admin/scores/export`}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {t("engagement.export", locale)}
            </Link>
          )}
          <button
            type="button"
            onClick={() => (scores !== null ? setExpanded((e) => !e) : loadScores())}
            disabled={loading}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {loading ? t("engagement.loading", locale) : expanded && scores !== null ? t("engagement.show_less", locale) : t("engagement.show_more", locale)}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-6 py-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {expanded && scores !== null && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t("engagement.export_rank", locale)}</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t("engagement.export_name", locale)}</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">{t("engagement.export_total", locale)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {scores.length > 0 ? (
                scores.map((score, index) => (
                  <tr key={score.id} className="transition hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">{index + 1}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {currentAuthUserId && score.profile?.auth_user_id === currentAuthUserId
                        ? t("engagement.you_row", locale)
                        : (score.profile?.full_name ?? "–")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className="font-bold tabular-nums text-gray-900">{score.total_score ?? 0}</span>
                        <button
                          type="button"
                          className="rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                          onClick={() => setDetailsFor(score)}
                        >
                          {t("events.details", locale)}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-gray-500">
                    {t("engagement.empty_scores", locale)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {detailsFor && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
          onClick={() => setDetailsFor(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                {detailsFor.profile?.full_name ?? "–"} {t("engagement.export_total", locale)}: {detailsFor.total_score ?? 0}
              </h3>
              <button
                type="button"
                className="-m-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-2 text-gray-600 hover:bg-blue-100 focus:outline-none dark:text-gray-300 dark:hover:bg-blue-900/30"
                onClick={() => setDetailsFor(null)}
                aria-label={t("common.close", locale)}
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              <div className="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-700 dark:text-gray-200">{t("engagement.export_task_points", locale)}</span>
                  <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">{detailsFor.task_points ?? 0}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-700 dark:text-gray-200">{t("engagement.export_shift_points", locale)}</span>
                  <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">{detailsFor.shift_points ?? 0}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-700 dark:text-gray-200">{t("engagement.export_material_points", locale)}</span>
                  <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">{detailsFor.material_points ?? 0}</span>
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("engagement.log_title", locale)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
