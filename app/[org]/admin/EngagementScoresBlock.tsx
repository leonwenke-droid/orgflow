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

  async function loadScores() {
    if (scores !== null) {
      setExpanded(true);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await getEngagementScoresAction(orgSlug);
    setLoading(false);
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
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Engagement Scores</h2>
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
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Rang</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Team</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Aufgaben</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Shifts</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Material</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Gesamt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {scores.length > 0 ? (
                scores.map((score, index) => (
                  <tr key={score.id} className="transition hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">{index + 1}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {currentAuthUserId && score.profile?.auth_user_id === currentAuthUserId ? "Du" : (score.profile?.full_name ?? "–")}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {score.profile?.committee?.name ?? "–"}
                    </td>
                    <td className="px-6 py-4 text-right text-sm tabular-nums text-gray-600">{score.task_points ?? 0}</td>
                    <td className="px-6 py-4 text-right text-sm tabular-nums text-gray-600">{score.shift_points ?? 0}</td>
                    <td className="px-6 py-4 text-right text-sm tabular-nums text-gray-600">{score.material_points ?? 0}</td>
                    <td className="px-6 py-4 text-right font-bold tabular-nums text-gray-900">{score.total_score ?? 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    No engagement data available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
