"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getEngagementScoresAction,
  getEngagementLogForProfileAction,
  type EngagementLogRow,
  type ScoreRow
} from "./actions";
import { useLocale } from "../../../components/LocaleProvider";
import { t, type Locale } from "../../../lib/i18n";
import { formatLocaleDateFromIso } from "../../../lib/formatDate";

function eventTypeLabel(type: string | null | undefined, loc: Locale): string {
  if (!type) return "–";
  const key = `engagement.event_type.${type}`;
  const label = t(key, loc);
  if (label !== key) return label;
  return type.replace(/_/g, " ");
}

export default function EngagementScoresBlock({ orgSlug, currentAuthUserId = null }: { orgSlug: string; currentAuthUserId?: string | null }) {
  const { locale } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState<ScoreRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailsFor, setDetailsFor] = useState<ScoreRow | null>(null);
  const [logEntries, setLogEntries] = useState<EngagementLogRow[] | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!detailsFor?.profile?.id) {
      setLogEntries(null);
      setLogError(null);
      setLogLoading(false);
      return;
    }
    let cancelled = false;
    setLogLoading(true);
    setLogError(null);
    setLogEntries(null);
    void getEngagementLogForProfileAction(orgSlug, detailsFor.profile.id).then((r) => {
      if (cancelled) return;
      setLogLoading(false);
      if (r.errorKey) {
        setLogError(t(r.errorKey, locale));
        setLogEntries([]);
        return;
      }
      setLogEntries(r.entries ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [detailsFor, orgSlug, locale]);

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-primary shadow-sm dark:border-border-default bg-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle px-6 py-5 dark:border-border-default">
        <div>
          <h2 className="text-xl font-bold text-text-primary dark:text-text-primary">{t("dashboard.engagement", locale)}</h2>
          <p className="mt-0.5 text-sm text-text-secondary dark:text-text-muted">
            {!expanded && t("engagement.points_title", locale)}
            {expanded && scores !== null && `${scores.length} ${t("engagement.members_count", locale)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {expanded && scores !== null && (
            <Link
              href={`/${orgSlug}/admin/scores/export`}
              className="btn-secondary"
            >
              {t("engagement.export", locale)}
            </Link>
          )}
          <button
            type="button"
            onClick={() => (scores !== null ? setExpanded((e) => !e) : loadScores())}
            disabled={loading}
            className="rounded-xl border border-border-default bg-bg-primary px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-bg-secondary disabled:opacity-50 dark:border-border-default dark:bg-bg-primary dark:text-text-primary dark:hover:bg-bg-tertiary"
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
            <thead className="bg-bg-secondary dark:bg-bg-primary/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary dark:text-text-muted">
                  {t("engagement.export_rank", locale)}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary dark:text-text-muted">
                  {t("engagement.export_name", locale)}
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-secondary dark:text-text-muted">
                  {t("engagement.export_total", locale)}
                </th>
              </tr>
            </thead>
            <tbody>
              {scores.length > 0 ? (
                scores.map((score, index) => (
                  <tr key={score.id} className="transition hover:bg-bg-secondary dark:hover:bg-bg-primary/50">
                    <td className="px-6 py-4 text-sm text-text-secondary dark:text-text-muted">{index + 1}</td>
                    <td className="px-6 py-4 font-medium text-text-primary dark:text-text-primary">
                      {currentAuthUserId && score.profile?.auth_user_id === currentAuthUserId
                        ? t("engagement.you_row", locale)
                        : (score.profile?.full_name ?? "–")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className="font-bold tabular-nums text-text-primary dark:text-text-primary">{score.total_score ?? 0}</span>
                        <button
                          type="button"
                          className="btn-secondary"
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
                  <td colSpan={3} className="px-6 py-10 text-center text-text-secondary">
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
            className="w-full max-w-lg rounded-xl border border-border-subtle bg-bg-primary shadow-xl dark:border-border-default dark:bg-bg-primary pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-bg-secondary px-3 py-2.5 dark:border-border-default dark:bg-bg-primary">
              <h3 className="text-xs font-semibold text-text-primary dark:text-text-primary">
                {detailsFor.profile?.full_name ?? "–"} {t("engagement.export_total", locale)}: {detailsFor.total_score ?? 0}
              </h3>
              <button
                type="button"
                className="-m-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-2 text-text-secondary hover:bg-[var(--bg-brand-subtle)] focus:outline-none dark:text-text-secondary dark:hover:bg-blue-900/30"
                onClick={() => setDetailsFor(null)}
                aria-label={t("common.close", locale)}
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              <div className="rounded border border-border-subtle bg-bg-secondary p-3 dark:border-border-default dark:bg-bg-primary">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-text-secondary dark:text-text-primary">{t("engagement.export_task_points", locale)}</span>
                  <span className="font-medium tabular-nums text-text-primary dark:text-text-primary">{detailsFor.task_points ?? 0}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <span className="text-text-secondary dark:text-text-primary">{t("engagement.export_shift_points", locale)}</span>
                  <span className="font-medium tabular-nums text-text-primary dark:text-text-primary">{detailsFor.shift_points ?? 0}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                  <span className="text-text-secondary dark:text-text-primary">{t("engagement.export_material_points", locale)}</span>
                  <span className="font-medium tabular-nums text-text-primary dark:text-text-primary">{detailsFor.material_points ?? 0}</span>
                </div>
              </div>

              <p className="text-xs font-semibold text-text-secondary dark:text-text-secondary">{t("engagement.log_title", locale)}</p>
              {logLoading && <p className="text-xs text-text-secondary dark:text-text-muted">{t("engagement.log_loading", locale)}</p>}
              {logError && <p className="text-xs text-red-600 dark:text-red-400">{logError}</p>}
              {!logLoading && !logError && logEntries && logEntries.length === 0 && (
                <p className="text-xs text-text-secondary dark:text-text-muted">{t("engagement.log_empty", locale)}</p>
              )}
              {!logLoading && logEntries && logEntries.length > 0 && (
                <ul className="max-h-48 space-y-2 overflow-y-auto rounded border border-border-subtle bg-bg-primary p-2 text-xs dark:border-border-default dark:bg-bg-primary/70">
                  {logEntries.map((row) => (
                    <li key={row.id} className="border-b border-border-subtle pb-2 last:border-0 dark:border-border-default">
                      <div className="flex justify-between gap-2 font-medium text-text-primary dark:text-text-primary">
                        <span className="tabular-nums">{row.points > 0 ? `+${row.points}` : row.points}</span>
                        <span className="text-[10px] text-text-secondary dark:text-text-muted">
                          {formatLocaleDateFromIso(row.created_at, locale)}
                        </span>
                      </div>
                      {row.kind === "manual" ? (
                        <p className="mt-0.5 text-text-secondary dark:text-text-secondary">{row.reason ?? "–"}</p>
                      ) : (
                        <p className="mt-0.5 text-text-secondary dark:text-text-secondary">{eventTypeLabel(row.event_type, locale)}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
