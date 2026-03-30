"use client";

import { useMemo, useState } from "react";
import { useLocale } from "../../../../components/LocaleProvider";
import { t } from "../../../../lib/i18n";
import EngagementRulesClient from "./EngagementRulesClient";
import { formatLocaleDateTime } from "../../../../lib/formatDate";

type ScoreEntry = {
  user_id: string;
  score: number;
  name: string;
  team: string | null;
};

type EventEntry = {
  id: string;
  user_id: string;
  event_type: string;
  points: number | null;
  created_at: string;
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
  events: EventEntry[];
  weights: Record<string, number>;
  nameById: Record<string, string>;
};

const TABS = [
  { key: "overview", de: "Übersicht", en: "Overview" },
  { key: "ranking", de: "Rangliste", en: "Ranking" },
  { key: "members", de: "Mitglieder", en: "Members" },
  { key: "rules", de: "Punkteregeln", en: "Point rules" },
] as const;

export default function EngagementTabs({
  orgSlug,
  stats,
  scores,
  members,
  events,
  weights,
  nameById,
}: Props) {
  const { locale } = useLocale();
  const [tab, setTab] = useState<string>("overview");
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const topScore = scores.length > 0 ? scores[0].score : 0;

  const memberEvents = useMemo(() => {
    if (!expandedMember) return [];
    return events
      .filter((e) => e.user_id === expandedMember)
      .slice(0, 50);
  }, [expandedMember, events]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
              tab === t.key
                ? "bg-blue-100 font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {locale === "de" ? t.de : t.en}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="stat-card">
              <div className="section-label">
                {locale === "de" ? "Aktive Mitglieder" : "Active members"}
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-foreground-dark">
                {stats.activeMembers}
              </div>
            </div>
            <div className="stat-card">
              <div className="section-label">
                {locale === "de" ? "Durchschnittsscore" : "Avg. score"}
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-foreground-dark">
                {stats.avgScore}
              </div>
            </div>
            <div className="stat-card">
              <div className="section-label">
                {locale === "de" ? "Aufgaben (30d)" : "Tasks (30d)"}
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-foreground-dark">
                {stats.tasksDone30d}
              </div>
            </div>
            <div className="stat-card">
              <div className="section-label">
                {locale === "de" ? "Schichten (30d)" : "Shifts (30d)"}
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-foreground-dark">
                {stats.shiftsDone30d}
              </div>
            </div>
            <div className="stat-card">
              <div className="section-label">
                {locale === "de" ? "Inaktiv (30d)" : "Inactive (30d)"}
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-foreground-dark">
                {stats.inactiveMembers}
              </div>
            </div>
          </section>
          <div className="card p-4">
            <div className="section-label">
              {locale === "de" ? "Top 10" : "Top 10"}
            </div>
            <ul className="mt-2 space-y-2">
              {scores.slice(0, 10).map((r, idx) => {
                const pct = topScore > 0 ? Math.round((r.score / topScore) * 100) : 0;
                return (
                  <li
                    key={r.user_id}
                    className={`rounded-lg px-3 py-2 ${idx === 0 ? "bg-warning-light text-warning-dark dark:bg-amber-900/30 dark:text-amber-300" : "bg-gray-50 dark:bg-gray-800/60"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 text-xs font-medium">#{idx + 1}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{r.name}</div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-white/70 dark:bg-gray-700">
                          <div className="h-1.5 rounded-full bg-brand" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-medium tabular-nums">{r.score}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {tab === "ranking" && (
        <div className="card overflow-hidden">
          <div className="-mx-0 overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                  <th className="w-12 px-4 py-3 text-xs font-medium text-gray-500">#</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Team</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 text-right">Score</th>
                  <th className="w-40 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {scores.map((r, idx) => {
                  const pct = topScore > 0 ? Math.round((r.score / topScore) * 100) : 0;
                  return (
                    <tr key={r.user_id} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                      <td className="px-4 py-2 text-xs text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{r.name}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{r.team || "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.score}</td>
                      <td className="px-4 py-2">
                        <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                          <div className="h-1.5 rounded-full bg-brand" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "members" && (
        <div className="card overflow-hidden">
          <div className="-mx-0 overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Team</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 text-right">Score</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 text-right">
                    {locale === "de" ? "Aufgaben" : "Tasks"}
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 text-right">
                    {locale === "de" ? "Schichten" : "Shifts"}
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">
                    {locale === "de" ? "Letzte Aktivität" : "Last activity"}
                  </th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <>
                    <tr
                      key={m.id}
                      className="border-b border-gray-100 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40"
                      onClick={() => setExpandedMember(expandedMember === m.id ? null : m.id)}
                    >
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{m.full_name}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{m.team || "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{m.score}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{m.tasksDone}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{m.shiftsDone}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {m.lastActivity ? formatLocaleDateTime(m.lastActivity, locale) : "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400">
                        {expandedMember === m.id ? "▲" : "▼"}
                      </td>
                    </tr>
                    {expandedMember === m.id && (
                      <tr key={`${m.id}-log`}>
                        <td colSpan={7} className="bg-gray-50 px-8 py-3 dark:bg-gray-800/30">
                          <div className="section-label">
                            {locale === "de" ? "Aktivitätslog" : "Activity log"}
                          </div>
                          {memberEvents.length === 0 ? (
                            <p className="text-xs text-gray-500">—</p>
                          ) : (
                            <ul className="mt-1 space-y-1">
                              {memberEvents.map((e) => (
                                <li key={e.id} className="flex items-center gap-3 text-xs">
                                  <span className="text-gray-400">
                                    {formatLocaleDateTime(e.created_at, locale)}
                                  </span>
                                  <span className="tag tag-neutral">{e.event_type}</span>
                                  {e.points != null && (
                                    <span className={e.points >= 0 ? "text-green-600" : "text-red-600"}>
                                      {e.points >= 0 ? "+" : ""}{e.points}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "rules" && (
        <EngagementRulesClient orgSlug={orgSlug} initialWeights={weights} />
      )}
    </div>
  );
}
