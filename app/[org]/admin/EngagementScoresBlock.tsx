"use client";

import { useState } from "react";
import Link from "next/link";
import { getEngagementScoresAction, type ScoreRow } from "./actions";

export default function EngagementScoresBlock({ orgSlug, currentAuthUserId = null }: { orgSlug: string; currentAuthUserId?: string | null }) {
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
    <div className="rounded-2xl border border-cyan-500/20 bg-card/80 shadow-lg shadow-cyan-950/20 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-500/20 px-6 py-5">
        <div>
          <h2 className="text-xl font-bold text-white">Engagement Scores</h2>
          <p className="mt-0.5 text-sm text-cyan-400/90">
            {!expanded && "Rangliste nach Punkten – auf «Mehr anzeigen» klicken zum Laden."}
            {expanded && scores !== null && `${scores.length} Mitglieder`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {expanded && scores !== null && (
            <Link
              href={`/${orgSlug}/admin/scores/export`}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-cyan-500"
            >
              Exportieren
            </Link>
          )}
          <button
            type="button"
            onClick={() => (scores !== null ? setExpanded((e) => !e) : loadScores())}
            disabled={loading}
            className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
          >
            {loading ? "Lade…" : expanded && scores !== null ? "Weniger anzeigen" : "Mehr anzeigen"}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-6 py-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {expanded && scores !== null && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cyan-500/10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cyan-400">Rang</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cyan-400">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-cyan-400">Komitee</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-cyan-400">Aufgaben</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-cyan-400">Schichten</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-cyan-400">Material</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-cyan-400">Gesamt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-500/10">
              {scores.length > 0 ? (
                scores.map((score, index) => (
                  <tr key={score.id} className="transition hover:bg-cyan-500/5">
                    <td className="px-6 py-4 text-sm text-cyan-300">{index + 1}</td>
                    <td className="px-6 py-4 font-medium text-white">
                      {currentAuthUserId && score.profile?.auth_user_id === currentAuthUserId ? "Du" : (score.profile?.full_name ?? "–")}
                    </td>
                    <td className="px-6 py-4 text-sm text-cyan-400">
                      {score.profile?.committee?.name ?? "–"}
                    </td>
                    <td className="px-6 py-4 text-right text-sm tabular-nums text-cyan-300">{score.task_points ?? 0}</td>
                    <td className="px-6 py-4 text-right text-sm tabular-nums text-cyan-300">{score.shift_points ?? 0}</td>
                    <td className="px-6 py-4 text-right text-sm tabular-nums text-cyan-300">{score.material_points ?? 0}</td>
                    <td className="px-6 py-4 text-right font-bold tabular-nums text-white">{score.total_score ?? 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-cyan-400/80">
                    Noch keine Engagement-Daten verfügbar.
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
