"use client";

import { useMemo, useState } from "react";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";
import EngagementRulesClient from "./EngagementRulesClient";
import { awardExtraPointsAction } from "./actions";

type ScoreEntry = {
  user_id: string;
  score: number;
  name: string;
  team: string | null;
};

type MemberEntry = {
  id: string;
  full_name: string;
  team: string | null;
  score: number;
  tasksDone: number;
  shiftsDone: number;
  lastActivity: string | null;
};

type Props = {
  orgSlug: string;
  stats: {
    activeMembers: number;
    avgScore: number;
    tasksDone30d: number;
    shiftsDone30d: number;
    inactiveMembers: number;
  };
  scores: ScoreEntry[];
  members: MemberEntry[];
  events: { id: string; user_id: string; event_type: string; points: number | null; created_at: string }[];
  weights: Record<string, number>;
  nameById: Record<string, string>;
  totalMembers: number;
};

const AVATAR_COLORS = [
  "bg-blue-600 text-white",
  "bg-green-600 text-white",
  "bg-blue-400 text-white",
  "bg-gray-500 text-white",
  "bg-purple-600 text-white",
  "bg-rose-600 text-white",
  "bg-teal-600 text-white",
  "bg-orange-500 text-white",
];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export default function EngagementTabs({
  orgSlug,
  stats,
  scores,
  members,
  weights,
  totalMembers,
}: Props) {
  const { locale } = useLocale();
  const topScore = scores.length > 0 ? scores[0].score : 1;

  const [showAwardForm, setShowAwardForm] = useState(false);
  const [awardUserId, setAwardUserId] = useState("");
  const [awardPoints, setAwardPoints] = useState("");
  const [awardReason, setAwardReason] = useState("");
  const [awarding, setAwarding] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);
  const [awardSuccess, setAwardSuccess] = useState(false);

  async function handleAward() {
    if (!awardUserId || !awardPoints) return;
    setAwarding(true);
    setAwardError(null);
    setAwardSuccess(false);
    const res = await awardExtraPointsAction(orgSlug, awardUserId, Number(awardPoints), awardReason);
    setAwarding(false);
    if (res.error) {
      setAwardError(res.error);
    } else {
      setAwardSuccess(true);
      setAwardPoints("");
      setAwardReason("");
      setTimeout(() => setAwardSuccess(false), 3000);
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <div className="section-label">
            {locale === "de" ? "Aktive Mitglieder" : "Active members"}
          </div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-foreground-dark">
            {stats.activeMembers}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {locale === "de" ? `von ${totalMembers}` : `of ${totalMembers}`}
          </div>
        </div>
        <div className="stat-card">
          <div className="section-label">
            {locale === "de" ? "Ø Score" : "Avg. score"}
          </div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-foreground-dark">
            {stats.avgScore.toLocaleString(locale === "de" ? "de-DE" : "en-US", { maximumFractionDigits: 1 })}
          </div>
        </div>
        <div className="stat-card">
          <div className="section-label">
            {locale === "de" ? "Aufgaben erledigt" : "Tasks completed"}
          </div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-foreground-dark">
            {stats.tasksDone30d}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {locale === "de" ? "diesen Monat" : "this month"}
          </div>
        </div>
      </section>

      {/* Rangliste */}
      <section className="card overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-foreground-dark">
            {locale === "de" ? "Rangliste" : "Leaderboard"}
          </h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {scores.map((entry, idx) => {
            const pct = topScore > 0 ? Math.round((entry.score / topScore) * 100) : 0;
            const isFirst = idx === 0;
            const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            return (
              <div
                key={entry.user_id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  isFirst
                    ? "bg-amber-900/20 dark:bg-amber-900/30"
                    : ""
                }`}
              >
                <span className={`w-6 text-center text-sm font-semibold ${isFirst ? "text-amber-400" : "text-gray-500 dark:text-gray-400"}`}>
                  {idx + 1}
                </span>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${colorClass}`}>
                  {getInitials(entry.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900 dark:text-foreground-dark">
                    {entry.name}
                  </div>
                </div>
                <div className="hidden w-32 sm:block">
                  <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-1.5 rounded-full bg-blue-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-foreground-dark">
                  {entry.score} Pts
                </span>
              </div>
            );
          })}
          {scores.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              {locale === "de" ? "Noch keine Punktedaten vorhanden." : "No score data yet."}
            </div>
          )}
        </div>
      </section>

      {/* Punkteregeln */}
      <EngagementRulesClient orgSlug={orgSlug} initialWeights={weights} />

      {/* Extra Punkte vergeben */}
      <section className="card overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-foreground-dark">
              {locale === "de" ? "Extra Punkte vergeben" : "Award extra points"}
            </h2>
            {!showAwardForm && (
              <button type="button" className="btn-secondary" onClick={() => setShowAwardForm(true)}>
                {locale === "de" ? "+ Punkte vergeben" : "+ Award points"}
              </button>
            )}
          </div>
        </div>
        {showAwardForm && (
          <div className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  {locale === "de" ? "Mitglied" : "Member"}
                </label>
                <select
                  value={awardUserId}
                  onChange={(e) => setAwardUserId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">{locale === "de" ? "Auswählen…" : "Select…"}</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  {locale === "de" ? "Punkte" : "Points"}
                </label>
                <input
                  type="number"
                  value={awardPoints}
                  onChange={(e) => setAwardPoints(e.target.value)}
                  placeholder="z. B. 5"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  {locale === "de" ? "Grund (optional)" : "Reason (optional)"}
                </label>
                <input
                  type="text"
                  value={awardReason}
                  onChange={(e) => setAwardReason(e.target.value)}
                  placeholder={locale === "de" ? "z. B. Sondereinsatz" : "e.g. Special effort"}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={awarding || !awardUserId || !awardPoints}
                onClick={handleAward}
                className="btn-primary"
              >
                {awarding ? "…" : locale === "de" ? "Punkte vergeben" : "Award points"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowAwardForm(false);
                  setAwardError(null);
                  setAwardSuccess(false);
                }}
              >
                {locale === "de" ? "Abbrechen" : "Cancel"}
              </button>
              {awardSuccess && (
                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                  {locale === "de" ? "Punkte vergeben!" : "Points awarded!"}
                </span>
              )}
              {awardError && (
                <span className="text-xs text-red-600 dark:text-red-400">{awardError}</span>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
