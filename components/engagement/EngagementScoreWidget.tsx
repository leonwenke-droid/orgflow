"use client";

import { useMemo, useState } from "react";
import { BarChart3, CheckCircle2, ListChecks, XCircle } from "lucide-react";
import { useLocale } from "../LocaleProvider";
import { t, type Locale } from "../../lib/i18n";
import type { EngagementBreakdown, EngagementEventRow, OrgScoreboardRow } from "../../lib/engagement/getScore";

type Tab = "breakdown" | "history" | "ranking";

type Props = {
  totalScore: number;
  breakdown: EngagementBreakdown;
  recentEvents: EngagementEventRow[];
  orgScoreboard: OrgScoreboardRow[];
  profileId: string;
  displayName?: string | null;
};

type Accent = "brand" | "success" | "warning" | "neutral";

function accentStyle(accent: Accent): { solid: string; subtle: string; text: string } {
  switch (accent) {
    case "brand":
      return { solid: "var(--color-brand)", subtle: "var(--bg-brand-subtle)", text: "var(--color-brand-text)" };
    case "success":
      return { solid: "var(--color-success)", subtle: "var(--bg-success-subtle)", text: "var(--color-success-text)" };
    case "warning":
      return { solid: "var(--color-warning)", subtle: "var(--bg-warning-subtle)", text: "var(--color-warning-text)" };
    case "neutral":
      return { solid: "var(--text-secondary)", subtle: "var(--bg-tertiary)", text: "var(--text-secondary)" };
  }
}

function categoryLabel(category: string | null, locale: Locale): string {
  switch (category) {
    case "task":
      return t("engagement.cat.task", locale);
    case "shift_auto":
      return t("engagement.cat.shift_auto", locale);
    case "shift_rotation":
      return t("engagement.cat.shift_rotation", locale);
    default:
      return t("engagement.cat.other", locale);
  }
}

function eventTitle(ev: EngagementEventRow, locale: Locale): string {
  if (ev.task_title) return ev.task_title;
  if (ev.shift_label) return ev.shift_label;
  return eventTypeLabel(ev.event_type, locale);
}

function eventTypeLabel(eventType: string, locale: Locale): string {
  const key = `engagement.event_type.${eventType}` as const;
  const label = t(key, locale);
  return label === key ? eventType : label;
}

function initialsFromName(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function shortNameForRow(fullName: string | null, isMe: boolean, locale: Locale): string {
  if (!fullName?.trim()) return "—";
  if (isMe) return `${fullName.trim()} (${t("engagement.you", locale)})`;
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last[0]}.`;
}

function hashHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
}

function avatarStyle(seed: string): { background: string; color: string } {
  const hue = hashHue(seed);
  return {
    background: `hsl(${hue} 42% 36%)`,
    color: "hsl(0 0% 98%)"
  };
}

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function formatWeekAxisLabel(ms: number, locale: Locale): string {
  const w = getISOWeek(new Date(ms));
  return locale === "de" ? `KW${w}` : `W${w}`;
}

export default function EngagementScoreWidget({
  totalScore,
  breakdown,
  recentEvents,
  orgScoreboard,
  profileId,
  displayName
}: Props) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("breakdown");

  const total = breakdown.total_score;
  const safeTotal = Math.abs(total) < 1e-9 ? 1 : total;
  const taskPct = safeTotal !== 0 ? breakdown.task_score / safeTotal : 0;
  const autoPct = safeTotal !== 0 ? breakdown.shift_auto_score / safeTotal : 0;
  const rotPct = safeTotal !== 0 ? breakdown.shift_rotation_score / safeTotal : 0;
  const otherPct = safeTotal !== 0 ? breakdown.other_score / safeTotal : 0;

  const maxOrg = Math.max(...orgScoreboard.map((r) => r.total_score), 1);
  const myRank = orgScoreboard.findIndex((r) => r.user_id === profileId) + 1;

  const turnStart = taskPct;
  const turnMid1 = taskPct + autoPct;
  const turnMid2 = taskPct + autoPct + rotPct;
  const turnEnd = taskPct + autoPct + rotPct + otherPct;

  const headerInitials = initialsFromName(displayName);
  const headerStyle = avatarStyle(displayName ?? profileId);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-2xl border border-border-subtle bg-bg-primary p-4 shadow-sm transition hover:bg-bg-secondary dark:border-border-default focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-label={t("engagement.modal_aria", locale)}
      >
        <div className="section-label">{t("engagement.score_label", locale)}</div>
        <div className="mt-3 flex flex-wrap items-stretch gap-6">
          <div
            className="relative flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-full border-[7px] border-border-default/80"
            style={{
              background: `conic-gradient(var(--color-brand) 0turn ${turnStart}turn, var(--color-success) ${turnStart}turn ${turnMid1}turn, var(--color-warning) ${turnMid1}turn ${turnMid2}turn, var(--text-secondary) ${turnMid2}turn ${turnEnd}turn, var(--bg-tertiary) ${turnEnd}turn 1turn)`
            }}
          >
            <div className="flex h-[86px] w-[86px] flex-col items-center justify-center rounded-full bg-bg-primary shadow-inner">
              <span className="text-2xl font-semibold tabular-nums text-text-primary">{totalScore}</span>
              <span className="text-[10px] font-medium text-text-secondary">{t("engagement.points_short", locale)}</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2.5 text-sm">
            <BreakdownMini
              label={t("engagement.cat.task", locale)}
              score={breakdown.task_score}
              pct={taskPct}
              accent="brand"
              locale={locale}
            />
            <BreakdownMini
              label={t("engagement.cat.shift_auto", locale)}
              score={breakdown.shift_auto_score}
              pct={autoPct}
              accent="success"
              locale={locale}
            />
            <BreakdownMini
              label={t("engagement.cat.shift_rotation", locale)}
              score={breakdown.shift_rotation_score}
              pct={rotPct}
              accent="warning"
              locale={locale}
            />
            <p className="flex items-center gap-1.5 pt-1 text-xs font-medium text-brand">
              <BarChart3 className="h-3.5 w-3.5 opacity-90" aria-hidden />
              {t("engagement.widget_footer", locale)}
            </p>
          </div>
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="engagement-modal-title"
        >
          <div
            className="flex max-h-[min(92vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border-subtle bg-bg-primary shadow-2xl dark:border-border-default sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-border-subtle px-4 py-4 dark:border-border-default">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                style={headerStyle}
                aria-hidden
              >
                {headerInitials}
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="engagement-modal-title" className="text-base font-semibold text-text-primary">
                  {displayName?.trim() || t("engagement.score_title", locale)}
                </h2>
                <p className="mt-0.5 text-sm text-text-secondary">
                  {t("engagement.modal_score_line", locale).replace("{n}", String(totalScore))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 text-text-secondary transition hover:bg-bg-secondary"
                aria-label={t("common.close", locale)}
              >
                ✕
              </button>
            </div>

            <div className="border-b border-border-subtle px-2 py-2 dark:border-border-default">
              <div className="flex gap-1.5 rounded-xl bg-bg-secondary/80 p-1 dark:bg-bg-primary/80">
                {(["breakdown", "history", "ranking"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition ${
                      tab === k
                        ? "bg-bg-primary text-text-primary shadow-sm ring-1 ring-border-default dark:bg-bg-tertiary"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {k === "breakdown"
                      ? t("engagement.breakdown", locale)
                      : k === "history"
                        ? t("engagement.history", locale)
                        : t("engagement.compare", locale)}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {tab === "breakdown" && (
                <div className="space-y-3">
                  <CategoryBlock
                    label={t("engagement.cat.task", locale)}
                    hint={t("engagement.category_hint_task", locale)}
                    score={breakdown.task_score}
                    count={breakdown.task_count}
                    pct={taskPct}
                    accent="brand"
                    locale={locale}
                  />
                  <CategoryBlock
                    label={t("engagement.cat.shift_auto", locale)}
                    hint={t("engagement.category_hint_shift_auto", locale)}
                    score={breakdown.shift_auto_score}
                    count={breakdown.shift_auto_count}
                    pct={autoPct}
                    accent="success"
                    locale={locale}
                  />
                  <CategoryBlock
                    label={t("engagement.cat.shift_rotation", locale)}
                    hint={t("engagement.category_hint_shift_rotation", locale)}
                    score={breakdown.shift_rotation_score}
                    count={breakdown.shift_rotation_count}
                    pct={rotPct}
                    accent="warning"
                    locale={locale}
                  />
                  {(breakdown.other_count > 0 || breakdown.other_score !== 0) && (
                    <CategoryBlock
                      label={t("engagement.cat.other", locale)}
                      hint={t("engagement.category_hint_other", locale)}
                      score={breakdown.other_score}
                      count={breakdown.other_count}
                      pct={safeTotal !== 0 ? breakdown.other_score / safeTotal : 0}
                      accent="neutral"
                      locale={locale}
                    />
                  )}
                  <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    {t("engagement.recent_events", locale)}
                  </p>
                  <ul className="overflow-hidden rounded-xl border border-border-subtle dark:border-border-default">
                    {recentEvents.slice(0, 12).map((ev, idx) => (
                      <EventRow key={ev.id} ev={ev} locale={locale} isLast={idx === Math.min(recentEvents.length, 12) - 1} />
                    ))}
                  </ul>
                </div>
              )}

              {tab === "history" && (
                <div className="space-y-4">
                  {recentEvents.length === 0 ? (
                    <p className="py-6 text-center text-sm text-text-secondary">{t("engagement.history_empty", locale)}</p>
                  ) : (
                    <>
                      <ScoreHistoryLineChart
                        recentEvents={recentEvents}
                        totalScore={totalScore}
                        locale={locale}
                      />
                      <HistoryStatBadges recentEvents={recentEvents} myRank={myRank} locale={locale} />
                      <ul className="overflow-hidden rounded-xl border border-border-subtle dark:border-border-default">
                        {recentEvents.map((ev, idx) => (
                          <EventRow key={ev.id} ev={ev} locale={locale} isLast={idx === recentEvents.length - 1} />
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              {tab === "ranking" && (
                <div className="space-y-3">
                  <p className="text-xs text-text-secondary">{t("engagement.comparison_intro", locale)}</p>
                  <ul className="space-y-2">
                    {orgScoreboard.slice(0, 25).map((row, i) => {
                      const isMe = row.user_id === profileId;
                      const showBar = row.total_score > 0;
                      const pct =
                        showBar && maxOrg > 0
                          ? Math.min(100, Math.round((row.total_score / maxOrg) * 100))
                          : 0;
                      const tierBar =
                        isMe && showBar
                          ? "bg-[#185FA5]"
                          : showBar && i < 2
                            ? "bg-emerald-600"
                            : showBar
                              ? "bg-amber-600/90"
                              : "";
                      const seed = row.full_name ?? row.user_id;
                      const av = avatarStyle(seed);
                      return (
                        <li
                          key={row.user_id}
                          className={`rounded-xl px-3 py-2.5 ${
                            isMe ? "bg-[#185FA5]/12 ring-1 ring-[#185FA5]/35" : "bg-bg-secondary/60 dark:bg-bg-secondary/40"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                              style={av}
                            >
                              {initialsFromName(row.full_name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="truncate text-sm font-medium text-text-primary">
                                  {shortNameForRow(row.full_name, isMe, locale)}
                                </span>
                                <span className="shrink-0 text-sm tabular-nums text-text-primary">
                                  {row.total_score} {t("engagement.points_short", locale)}
                                </span>
                              </div>
                              {showBar ? (
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-tertiary/90">
                                  <div className={`h-full rounded-full ${tierBar}`} style={{ width: `${pct}%` }} />
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {myRank > 0 && tab !== "history" && (
              <div className="border-t border-border-subtle px-4 py-3 text-center text-xs text-text-secondary dark:border-border-default">
                {t("engagement.rank_in_org", locale).replace("{n}", String(myRank))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function BreakdownMini({
  label,
  score,
  pct,
  accent,
  locale
}: {
  label: string;
  score: number;
  pct: number;
  accent: Accent;
  locale: Locale;
}) {
  const p = Math.round(pct * 100);
  const a = accentStyle(accent);
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-2 text-text-secondary">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.solid }} />
          <span className="truncate font-medium text-text-primary">{label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="tabular-nums text-text-primary">
            {score} {t("engagement.points_short", locale)}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ring-1 ring-border-subtle"
            style={{ background: a.subtle, color: a.text }}
          >
            {p}%
          </span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-tertiary">
        <div className="h-full rounded-full" style={{ width: `${p}%`, background: a.solid }} />
      </div>
    </div>
  );
}

function CategoryBlock({
  label,
  hint,
  score,
  count,
  pct,
  accent,
  locale
}: {
  label: string;
  hint: string;
  score: number;
  count: number;
  pct: number;
  accent: Accent;
  locale: Locale;
}) {
  const p = Math.round(pct * 100);
  const a = accentStyle(accent);
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-secondary/90 p-3.5 dark:border-border-default dark:bg-bg-secondary/50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: a.solid }} />
          <div>
            <div className="text-sm font-semibold text-text-primary">{label}</div>
            <div className="mt-0.5 text-xs text-text-secondary">
              {score} {t("engagement.points_short", locale)} · {count}×
            </div>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums ring-1 ring-border-subtle"
          style={{ background: a.subtle, color: a.text }}
        >
          {p}%
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-text-secondary/90">{hint}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-tertiary">
        <div className="h-full rounded-full" style={{ width: `${p}%`, background: a.solid }} />
      </div>
    </div>
  );
}

function EventRow({ ev, locale, isLast }: { ev: EngagementEventRow; locale: Locale; isLast: boolean }) {
  const positive = ev.points >= 0;
  const Icon = positive ? CheckCircle2 : XCircle;
  const iconClass = positive ? "text-emerald-500" : "text-red-500";
  const meta = t("engagement.events_meta", locale)
    .replace("{category}", categoryLabel(ev.category, locale))
    .replace("{date}", formatDateShort(ev.created_at, locale));
  return (
    <li
      className={`flex gap-3 px-3 py-3 text-sm ${
        isLast ? "" : "border-b border-border-subtle dark:border-border-default"
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-secondary/80 dark:bg-bg-tertiary/60">
        <Icon className={`h-5 w-5 ${iconClass}`} strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium leading-snug text-text-primary">{eventTitle(ev, locale)}</div>
        <div className="mt-0.5 text-xs text-text-secondary">{meta}</div>
      </div>
      <span
        className={`shrink-0 tabular-nums text-sm font-semibold ${positive ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}
      >
        {ev.points > 0 ? "+" : ""}
        {ev.points}
      </span>
    </li>
  );
}

function formatDateShort(iso: string | number, locale: Locale): string {
  const d = typeof iso === "number" ? new Date(iso) : new Date(iso);
  if (Number.isNaN(d.getTime())) return typeof iso === "string" ? iso : "";
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(d);
}

function buildCumulativeScoreSeries(events: EngagementEventRow[], totalScore: number): { t: number; y: number }[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const sumPoints = sorted.reduce((s, e) => s + e.points, 0);
  let balance = totalScore - sumPoints;
  return sorted.map((ev) => {
    balance += ev.points;
    return { t: new Date(ev.created_at).getTime(), y: balance };
  });
}

function sumPointsLastDays(events: EngagementEventRow[], days: number): number {
  const cutoff = Date.now() - days * 86400000;
  return events.reduce((s, e) => {
    const t = new Date(e.created_at).getTime();
    return t >= cutoff ? s + e.points : s;
  }, 0);
}

function HistoryStatBadges({
  recentEvents,
  myRank,
  locale
}: {
  recentEvents: EngagementEventRow[];
  myRank: number;
  locale: Locale;
}) {
  const weekPts = useMemo(() => sumPointsLastDays(recentEvents, 7), [recentEvents]);
  const avgWeek = useMemo(() => {
    if (recentEvents.length === 0) return 0;
    const ts = recentEvents.map((e) => new Date(e.created_at).getTime());
    const tMin = Math.min(...ts);
    const tMax = Math.max(...ts);
    const spanWeeks = Math.max((tMax - tMin) / (7 * 86400000), 1 / 7);
    const sum = recentEvents.reduce((s, e) => s + e.points, 0);
    return sum / spanWeeks;
  }, [recentEvents]);

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0
    }).format(n);

  const weekLabel =
    weekPts > 0 ? `+${weekPts}` : weekPts === 0 ? "0" : String(weekPts);

  return (
    <div className="flex flex-wrap gap-2">
      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-500/25">
        {t("engagement.badge_points_week", locale).replace("{n}", weekLabel)}
      </span>
      <span className="inline-flex items-center rounded-full bg-[#185FA5]/20 px-3 py-1.5 text-[11px] font-semibold text-blue-100 ring-1 ring-[#185FA5]/35">
        {t("engagement.badge_avg_week", locale).replace("{n}", fmt(avgWeek))}
      </span>
      {myRank > 0 && (
        <span className="inline-flex items-center rounded-full bg-bg-tertiary px-3 py-1.5 text-[11px] font-medium text-text-secondary ring-1 ring-border-subtle">
          {t("engagement.rank_in_org", locale).replace("{n}", String(myRank))}
        </span>
      )}
    </div>
  );
}

function ScoreHistoryLineChart({
  recentEvents,
  totalScore,
  locale
}: {
  recentEvents: EngagementEventRow[];
  totalScore: number;
  locale: Locale;
}) {
  const series = useMemo(
    () => buildCumulativeScoreSeries(recentEvents, totalScore),
    [recentEvents, totalScore]
  );

  const chart = useMemo(() => {
    const W = 360;
    const H = 148;
    const padX = 12;
    const padY = 14;
    const innerW = W - padX * 2;
    const innerH = H - padY * 2 - 18;

    if (series.length === 0) return null;

    const ts = series.map((p) => p.t);
    const ys = series.map((p) => p.y);
    let tMin = Math.min(...ts);
    let tMax = Math.max(...ts);
    let yMin = Math.min(...ys);
    let yMax = Math.max(...ys);
    if (tMin === tMax) {
      tMin -= 1;
      tMax += 1;
    }
    const yPad = Math.max((yMax - yMin) * 0.1, 1);
    yMin -= yPad;
    yMax += yPad;
    const ySpan = Math.max(yMax - yMin, 1e-6);
    const tSpan = tMax - tMin;

    const xOf = (t: number) => padX + ((t - tMin) / tSpan) * innerW;
    const yOf = (y: number) => padY + innerH - ((y - yMin) / ySpan) * innerH;

    const pts = series.map((p) => `${xOf(p.t).toFixed(2)},${yOf(p.y).toFixed(2)}`).join(" ");
    const last = series[series.length - 1];
    const lx = xOf(last.t);
    const ly = yOf(last.y);
    const midT = tMin + tSpan / 2;

    const firstW = formatWeekAxisLabel(series[0].t, locale);
    const midW = formatWeekAxisLabel(midT, locale);

    return {
      W,
      H,
      pts,
      lx,
      ly,
      lastY: last.y,
      firstW,
      midW,
      aria: t("engagement.history_chart_aria", locale)
    };
  }, [series, locale]);

  if (!chart) return null;

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-secondary/90 p-4 dark:border-border-default dark:bg-bg-secondary/50">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
        {t("engagement.history_chart_caption", locale)}
      </p>
      <svg viewBox={`0 0 ${chart.W} ${chart.H}`} className="w-full text-[#3B82F6]" role="img" aria-label={chart.aria}>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={chart.pts}
        />
        <circle cx={chart.lx} cy={chart.ly} r="5" fill="currentColor" />
        <text
          x={chart.lx}
          y={chart.ly - 12}
          textAnchor="middle"
          className="fill-text-primary text-[11px] font-bold"
          style={{ fill: "var(--text-primary, #f8fafc)" }}
        >
          {Math.round(chart.lastY)}
        </text>
        <text x={12} y={chart.H - 4} style={{ fill: "var(--text-secondary, #94a3b8)", fontSize: 9 }}>
          {chart.firstW}
        </text>
        <text
          x={chart.W / 2}
          y={chart.H - 4}
          textAnchor="middle"
          style={{ fill: "var(--text-secondary, #94a3b8)", fontSize: 9 }}
        >
          {chart.midW}
        </text>
        <text
          x={chart.W - 12}
          y={chart.H - 4}
          textAnchor="end"
          style={{ fill: "var(--text-secondary, #94a3b8)", fontSize: 9 }}
        >
          {t("engagement.history_axis_today", locale)}
        </text>
      </svg>
    </div>
  );
}
