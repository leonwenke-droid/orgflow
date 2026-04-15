"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";
import {
  deleteMemberUnavailabilityAction,
  submitMemberUnavailabilityRangesAction,
  type UnavailabilityRangeYmd
} from "../app/[org]/me/unavailability-actions";
import {
  expandDailyInclusive,
  expandWeeklyInclusive,
  formatYmdUtc,
  mergeYmdToRanges,
  parseYmdUtc
} from "../lib/unavailabilityDates";

type Row = {
  id: string;
  unavailable_from: string;
  unavailable_until: string;
  reason: string | null;
  status: string;
};

const ISO_WEEKDAYS: { iso: number; labelDe: string; labelEn: string }[] = [
  { iso: 1, labelDe: "Mo", labelEn: "Mon" },
  { iso: 2, labelDe: "Di", labelEn: "Tue" },
  { iso: 3, labelDe: "Mi", labelEn: "Wed" },
  { iso: 4, labelDe: "Do", labelEn: "Thu" },
  { iso: 5, labelDe: "Fr", labelEn: "Fri" },
  { iso: 6, labelDe: "Sa", labelEn: "Sat" },
  { iso: 7, labelDe: "So", labelEn: "Sun" }
];

function daysInMonthUtc(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function monthMatrix(year: number, month: number): (string | null)[] {
  const dim = daysInMonthUtc(year, month);
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const mondayFirst = (first + 6) % 7;
  const cells: (string | null)[] = [];
  for (let i = 0; i < mondayFirst; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) {
    cells.push(formatYmdUtc(new Date(Date.UTC(year, month, d))));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function MemberUnavailabilityPlanner({ orgSlug, rows }: { orgSlug: string; rows: Row[] }) {
  const { locale } = useLocale();
  const router = useRouter();
  const de = locale === "de";

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [monthOffset, setMonthOffset] = useState(0);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeUntil, setRangeUntil] = useState("");
  const [dailyFrom, setDailyFrom] = useState("");
  const [dailyUntil, setDailyUntil] = useState("");
  const [weeklyFrom, setWeeklyFrom] = useState("");
  const [weeklyUntil, setWeeklyUntil] = useState("");
  const [weekdayPick, setWeekdayPick] = useState<Set<number>>(() => new Set([1, 2, 3, 4, 5]));
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const view = useMemo(() => {
    const base = new Date();
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth() + monthOffset;
    const d = new Date(Date.UTC(y, m, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth(), label: d.toLocaleDateString(de ? "de-DE" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) };
  }, [monthOffset, de]);

  const matrix = useMemo(() => monthMatrix(view.year, view.month), [view.year, view.month]);

  function toggleDay(ymd: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ymd)) next.delete(ymd);
      else next.add(ymd);
      return next;
    });
  }

  function addRangeToSelection() {
    if (!rangeFrom || !rangeUntil) return;
    const expanded = expandDailyInclusive(rangeFrom, rangeUntil);
    if (expanded.length === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      expanded.forEach((d) => next.add(d));
      return next;
    });
  }

  function addDailySeries() {
    if (!dailyFrom || !dailyUntil) return;
    const expanded = expandDailyInclusive(dailyFrom, dailyUntil);
    if (expanded.length === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      expanded.forEach((d) => next.add(d));
      return next;
    });
  }

  function addWeeklySeries() {
    if (!weeklyFrom || !weeklyUntil || weekdayPick.size === 0) return;
    const expanded = expandWeeklyInclusive(weeklyFrom, weeklyUntil, [...weekdayPick]);
    if (expanded.length === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      expanded.forEach((d) => next.add(d));
      return next;
    });
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const days = [...selected].sort();
    const ranges: UnavailabilityRangeYmd[] = mergeYmdToRanges(days);
    if (ranges.length === 0) {
      setMsg(de ? "Bitte mindestens einen Tag wählen." : "Pick at least one day.");
      setLoading(false);
      return;
    }
    const res = await submitMemberUnavailabilityRangesAction(orgSlug, ranges, reason.trim() || null);
    setLoading(false);
    if (res.error) setMsg(res.error);
    else {
      setSelected(new Set());
      setReason("");
      setMsg(de ? "Anfrage gesendet — Freigabe durch Team/Admin ausstehend." : "Request sent — pending approval.");
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (!confirm(de ? "Eintrag löschen?" : "Remove this entry?")) return;
    setLoading(true);
    const res = await deleteMemberUnavailabilityAction(orgSlug, id);
    setLoading(false);
    if (res.error) setMsg(res.error);
    else router.refresh();
  }

  function statusClass(st: string) {
    if (st === "pending") return "tag tag-amber";
    if (st === "approved") return "tag tag-green";
    return "tag tag-red";
  }

  function statusLabel(st: string) {
    if (st === "pending") return t("unavailability.status_pending", locale);
    if (st === "approved") return t("unavailability.status_approved", locale);
    return t("unavailability.status_rejected", locale);
  }

  function fmtRange(isoFrom: string, isoUntil: string) {
    const a = parseYmdUtc(isoFrom.slice(0, 10));
    const b = parseYmdUtc(isoUntil.slice(0, 10));
    return `${a.toLocaleDateString(de ? "de-DE" : "en-GB", { dateStyle: "medium" })} – ${b.toLocaleDateString(de ? "de-DE" : "en-GB", { dateStyle: "medium" })}`;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-secondary dark:text-text-muted">{t("unavailability.intro", locale)}</p>
      <p className="text-xs text-text-secondary dark:text-text-muted">{t("unavailability.pending_note", locale)}</p>

      <form onSubmit={submitRequest} className="space-y-4 rounded-lg border border-border-subtle bg-bg-secondary p-4 dark:border-border-default">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-text-primary dark:text-text-primary">
            {t("unavailability.selected_days", locale)}: {selected.size}
          </div>
          <button
            type="button"
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            onClick={() => setSelected(new Set())}
          >
            {t("unavailability.clear", locale)}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded-md border border-border-subtle bg-bg-primary p-3 dark:border-border-default">
            <div className="text-xs font-semibold text-text-secondary">{t("unavailability.add_range", locale)}</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-0.5 block text-[10px] text-text-secondary">{t("unavailability.range_from", locale)}</label>
                <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="w-full rounded border border-border-subtle bg-bg-primary px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] text-text-secondary">{t("unavailability.range_until", locale)}</label>
                <input type="date" value={rangeUntil} onChange={(e) => setRangeUntil(e.target.value)} className="w-full rounded border border-border-subtle bg-bg-primary px-2 py-1 text-sm" />
              </div>
            </div>
            <button type="button" className="btn-secondary w-full py-1.5 text-xs" onClick={addRangeToSelection}>
              {t("unavailability.apply_range", locale)}
            </button>
          </div>

          <div className="space-y-2 rounded-md border border-border-subtle bg-bg-primary p-3 dark:border-border-default">
            <div className="text-xs font-semibold text-text-secondary">{t("unavailability.daily_series", locale)}</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-0.5 block text-[10px] text-text-secondary">{t("unavailability.daily_from", locale)}</label>
                <input type="date" value={dailyFrom} onChange={(e) => setDailyFrom(e.target.value)} className="w-full rounded border border-border-subtle bg-bg-primary px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] text-text-secondary">{t("unavailability.daily_until", locale)}</label>
                <input type="date" value={dailyUntil} onChange={(e) => setDailyUntil(e.target.value)} className="w-full rounded border border-border-subtle bg-bg-primary px-2 py-1 text-sm" />
              </div>
            </div>
            <button type="button" className="btn-secondary w-full py-1.5 text-xs" onClick={addDailySeries}>
              {t("unavailability.add_daily", locale)}
            </button>
          </div>
        </div>

        <div className="space-y-2 rounded-md border border-border-subtle bg-bg-primary p-3 dark:border-border-default">
          <div className="text-xs font-semibold text-text-secondary">{t("unavailability.weekly_series", locale)}</div>
          <div className="flex flex-wrap gap-1.5">
            {ISO_WEEKDAYS.map((w) => (
              <label key={w.iso} className="flex cursor-pointer items-center gap-1 rounded border border-border-subtle px-2 py-1 text-xs dark:border-border-default">
                <input
                  type="checkbox"
                  checked={weekdayPick.has(w.iso)}
                  onChange={() => {
                    setWeekdayPick((prev) => {
                      const n = new Set(prev);
                      if (n.has(w.iso)) n.delete(w.iso);
                      else n.add(w.iso);
                      return n;
                    });
                  }}
                />
                {de ? w.labelDe : w.labelEn}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] text-text-secondary">{t("unavailability.weekly_from", locale)}</label>
              <input type="date" value={weeklyFrom} onChange={(e) => setWeeklyFrom(e.target.value)} className="w-full rounded border border-border-subtle bg-bg-primary px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] text-text-secondary">{t("unavailability.weekly_until", locale)}</label>
              <input type="date" value={weeklyUntil} onChange={(e) => setWeeklyUntil(e.target.value)} className="w-full rounded border border-border-subtle bg-bg-primary px-2 py-1 text-sm" />
            </div>
          </div>
          <button type="button" className="btn-secondary w-full py-1.5 text-xs" onClick={addWeeklySeries}>
            {t("unavailability.add_weekly", locale)}
          </button>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-text-secondary">{t("unavailability.calendar_preview", locale)}</div>
            <div className="flex items-center gap-1">
              <button type="button" className="rounded border border-border-subtle px-2 py-0.5 text-xs dark:border-border-default" onClick={() => setMonthOffset((m) => m - 1)}>
                ‹
              </button>
              <span className="min-w-[10rem] text-center text-xs font-medium capitalize">{view.label}</span>
              <button type="button" className="rounded border border-border-subtle px-2 py-0.5 text-xs dark:border-border-default" onClick={() => setMonthOffset((m) => m + 1)}>
                ›
              </button>
            </div>
          </div>
          <p className="mb-2 text-[10px] text-text-secondary">{t("unavailability.calendar_help", locale)}</p>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-text-secondary">
            {ISO_WEEKDAYS.map((w) => (
              <div key={w.iso}>{de ? w.labelDe : w.labelEn}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {matrix.map((cell, idx) =>
              cell ? (
                <button
                  key={`${cell}-${idx}`}
                  type="button"
                  onClick={() => toggleDay(cell)}
                  className={`rounded border py-1.5 text-xs font-medium transition-colors ${
                    selected.has(cell)
                      ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-600"
                      : "border-border-subtle bg-bg-primary text-text-primary hover:bg-bg-secondary dark:border-border-default dark:bg-bg-primary"
                  }`}
                >
                  {Number(cell.slice(8, 10))}
                </button>
              ) : (
                <div key={`empty-${idx}`} />
              )
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-text-secondary">{t("unavailability.reason", locale)}</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-border-subtle bg-bg-primary px-2 py-1.5 text-sm"
            disabled={loading}
            placeholder={de ? "z. B. Urlaub, Prüfungsphase" : "e.g. vacation, exams"}
          />
        </div>

        {msg ? <p className="text-xs text-text-secondary">{msg}</p> : null}

        <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={loading || selected.size === 0}>
          {loading ? t("unavailability.submitting", locale) : t("unavailability.submit_request", locale)}
        </button>
      </form>

      <div>
        <h3 className="text-sm font-semibold text-text-primary dark:text-text-primary">{t("unavailability.existing", locale)}</h3>
        <ul className="mt-2 divide-y divide-border-subtle rounded-lg border border-border-subtle dark:divide-border-default dark:border-border-default">
          {rows.length === 0 ? (
            <li className="p-3 text-sm text-text-secondary">{t("unavailability.none_yet", locale)}</li>
          ) : (
            rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <span className="text-text-primary dark:text-text-primary">{fmtRange(r.unavailable_from, r.unavailable_until)}</span>
                  {r.reason ? <span className="text-text-secondary"> — {r.reason}</span> : null}
                  <div className="mt-1">
                    <span className={statusClass(r.status)}>{statusLabel(r.status)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                  onClick={() => void remove(r.id)}
                  disabled={loading}
                >
                  {t("unavailability.remove", locale)}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
