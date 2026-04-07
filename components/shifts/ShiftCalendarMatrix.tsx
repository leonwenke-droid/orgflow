"use client";

import { Fragment, useMemo, useState } from "react";
import { useLocale } from "../LocaleProvider";
import { t } from "../../lib/i18n";
import type { ShiftForPdf } from "../ShiftAttendancePdfExport";

function eventGroupKey(eventName: string) {
  return String(eventName ?? "")
    .trim()
    .replace(/\s*–\s*[12]\.\s*Pause$/i, "")
    .replace(/\s*–\s*\d{1,2}:\d{2}–\d{1,2}:\d{2}$/, "")
    .trim() || "—";
}

function daysInMonth(y: number, m0: number) {
  return new Date(y, m0 + 1, 0).getDate();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export default function ShiftCalendarMatrix({
  shifts,
  todayStr,
  onOpenShiftDetail,
  showWeekNav = false
}: {
  shifts: ShiftForPdf[];
  todayStr: string;
  /** When set, clicking a shift in the day list or week matrix opens detail UI (parent renders drawer). */
  onOpenShiftDetail?: (shift: ShiftForPdf) => void;
  showWeekNav?: boolean;
}) {
  const { locale } = useLocale();
  const [cursor, setCursor] = useState(() => {
    const t = todayStr.slice(0, 10);
    const [y, m] = t.split("-").map(Number);
    return { y: y || new Date().getFullYear(), m0: (m || 1) - 1 };
  });

  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr.slice(0, 10));

  const monthLabel = useMemo(() => {
    const d = new Date(cursor.y, cursor.m0, 1);
    return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", {
      month: "long",
      year: "numeric"
    }).format(d);
  }, [cursor.y, cursor.m0, locale]);

  const shiftsByDate = useMemo(() => {
    const m = new Map<string, ShiftForPdf[]>();
    for (const s of shifts) {
      const d = String(s.date ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(s);
    }
    return m;
  }, [shifts]);

  const firstDow = new Date(cursor.y, cursor.m0, 1).getDay();
  const mondayStart = (firstDow + 6) % 7;
  const dim = daysInMonth(cursor.y, cursor.m0);
  const cells: (number | null)[] = [];
  for (let i = 0; i < mondayStart; i++) cells.push(null);
  for (let day = 1; day <= dim; day++) cells.push(day);

  const weekStart = useMemo(() => {
    if (!selectedDay || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDay)) {
      const t = todayStr.slice(0, 10);
      return t;
    }
    const [y, m, d] = selectedDay.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const dow = (dt.getDay() + 6) % 7;
    dt.setDate(dt.getDate() - dow);
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
  }, [selectedDay, todayStr]);

  const weekDays = useMemo(() => {
    const [y, m, d] = weekStart.split("-").map(Number);
    const out: string[] = [];
    const base = new Date(y, m - 1, d);
    for (let i = 0; i < 7; i++) {
      const dt = new Date(base);
      dt.setDate(base.getDate() + i);
      out.push(`${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`);
    }
    return out;
  }, [weekStart]);

  const matrixRows = useMemo(() => {
    const rowKeys = new Set<string>();
    for (const day of weekDays) {
      for (const s of shiftsByDate.get(day) ?? []) {
        rowKeys.add(eventGroupKey(s.event_name));
      }
    }
    return [...rowKeys].sort();
  }, [weekDays, shiftsByDate]);

  const slotLabel = (s: ShiftForPdf) => {
    const a = s.shift_assignments?.length ?? 0;
    const r = Math.max(1, Number(s.required_slots ?? 1) || 1);
    return `${a}/${r}`;
  };

  const cellStyle = (filled: number, cap: number) => {
    if (cap <= 0) return "bg-bg-secondary text-text-muted";
    const ratio = filled / cap;
    if (ratio >= 1) return "bg-[#EAF3DE] text-[#27500A] dark:bg-green-950/40 dark:text-green-200";
    if (ratio <= 0) return "bg-[#FCEBEB] text-[#791F1F] dark:bg-red-950/35 dark:text-red-200";
    return "bg-[#E6F1FB] text-[#0C447C] dark:bg-blue-950/40 dark:text-blue-200";
  };

  const selectedList = selectedDay ? shiftsByDate.get(selectedDay) ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="ui-pill text-xs"
            onClick={() =>
              setCursor((c) => {
                const nm = c.m0 - 1;
                return nm < 0 ? { y: c.y - 1, m0: 11 } : { y: c.y, m0: nm };
              })
            }
          >
            ←
          </button>
          <span className="text-sm font-semibold text-text-primary">{monthLabel}</span>
          <button
            type="button"
            className="ui-pill text-xs"
            onClick={() =>
              setCursor((c) => {
                const nm = c.m0 + 1;
                return nm > 11 ? { y: c.y + 1, m0: 0 } : { y: c.y, m0: nm };
              })
            }
          >
            →
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[var(--radius-modal)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 dark:border-white/10">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            {monthLabel}
          </h4>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => (
              <div key={w} className="py-1 text-text-muted">
                {locale === "en" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].indexOf(w)] : w}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day == null) return <div key={`e-${i}`} />;
              const ds = `${cursor.y}-${pad2(cursor.m0 + 1)}-${pad2(day)}`;
              const list = shiftsByDate.get(ds) ?? [];
              const has = list.length > 0;
              const isToday = ds === todayStr;
              const isSel = ds === selectedDay;
              return (
                <button
                  key={ds}
                  type="button"
                  onClick={() => setSelectedDay(ds)}
                  className={`rounded-md py-1 text-[11px] ${
                    isSel
                      ? "bg-text-primary text-bg-primary"
                      : isToday
                        ? "ring-1 ring-[var(--blue-mid)]"
                        : ""
                  } ${has && !isSel ? "font-semibold text-[var(--blue-mid)]" : "text-text-primary"}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-text-muted">{t("shifts.calendar_legend", locale)}</p>
        </div>

        <div className="rounded-[var(--radius-modal)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 dark:border-white/10">
          <h4 className="mb-2 text-xs font-semibold text-text-primary">
            {selectedDay
              ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", {
                  weekday: "short",
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                }).format(new Date(selectedDay + "T12:00:00"))
              : "—"}
          </h4>
          <div className="max-h-[280px] space-y-2 overflow-y-auto">
            {selectedList.length === 0 ? (
              <p className="text-[11px] text-text-muted">{t("shifts.calendar_no_shifts_day", locale)}</p>
            ) : (
              selectedList.map((s) => {
                const req = Math.max(1, Number(s.required_slots ?? 1) || 1);
                const n = s.shift_assignments?.length ?? 0;
                return (
                  <div
                    key={s.id}
                    role={onOpenShiftDetail ? "button" : undefined}
                    tabIndex={onOpenShiftDetail ? 0 : undefined}
                    onClick={onOpenShiftDetail ? () => onOpenShiftDetail(s) : undefined}
                    onKeyDown={
                      onOpenShiftDetail
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onOpenShiftDetail(s);
                            }
                          }
                        : undefined
                    }
                    className={`rounded-md border-l-[3px] border-[var(--blue-mid)] border border-[var(--border-subtle)] p-2 dark:border-white/10 ${
                      onOpenShiftDetail ? "cursor-pointer hover:bg-bg-secondary/80" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium text-text-primary">{s.event_name}</span>
                      <span className="shrink-0 rounded-full bg-bg-secondary px-2 py-0.5 text-[10px] text-text-secondary">
                        {slotLabel(s)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {String(s.start_time ?? "").slice(0, 5)}–{String(s.end_time ?? "").slice(0, 5)}
                      {s.location ? ` · ${s.location}` : ""}
                    </p>
                    <div className="mt-1 h-1 overflow-hidden rounded bg-bg-secondary">
                      <div
                        className="h-full rounded bg-[var(--blue-mid)]"
                        style={{ width: `${Math.min(100, Math.round((n / req) * 100))}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[var(--radius-modal)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 dark:border-white/10">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t("shifts.week_matrix_title", locale)}
        </h4>
        <div className="overflow-x-auto">
          <div
            className="grid gap-1 text-center"
            style={{
              gridTemplateColumns: `110px repeat(7, minmax(52px, 1fr))`,
              minWidth: "520px"
            }}
          >
            <div />
            {weekDays.map((d) => {
              const dt = new Date(d + "T12:00:00");
              const wd = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", {
                weekday: "short"
              }).format(dt);
              const dayNum = d.slice(8, 10);
              return (
                <div key={d} className="text-[10px] text-text-muted">
                  {wd} {dayNum}
                </div>
              );
            })}
            {matrixRows.length === 0 ? (
              <p
                className="py-4 text-center text-[11px] text-text-muted"
                style={{ gridColumn: "1 / -1" }}
              >
                {t("shifts.week_matrix_empty", locale)}
              </p>
            ) : (
              matrixRows.map((rowKey) => (
                <Fragment key={rowKey}>
                  <div className="flex items-center text-[11px] text-text-muted">
                    {rowKey.length > 18 ? `${rowKey.slice(0, 16)}…` : rowKey}
                  </div>
                  {weekDays.map((d) => {
                    const dayShifts = (shiftsByDate.get(d) ?? []).filter(
                      (s) => eventGroupKey(s.event_name) === rowKey
                    );
                    if (dayShifts.length === 0) {
                      return <div key={`${rowKey}-${d}`} />;
                    }
                    const s = dayShifts[0];
                    const req = Math.max(1, Number(s.required_slots ?? 1) || 1);
                    const n = s.shift_assignments?.length ?? 0;
                    const cellClass = `flex h-[22px] items-center justify-center rounded text-[10px] font-medium ${cellStyle(n, req)}`;
                    return onOpenShiftDetail ? (
                      <button
                        type="button"
                        key={`${rowKey}-${d}`}
                        onClick={() => onOpenShiftDetail(s)}
                        className={`${cellClass} cursor-pointer`}
                      >
                        {n}/{req}
                      </button>
                    ) : (
                      <div key={`${rowKey}-${d}`} className={cellClass}>
                        {n}/{req}
                      </div>
                    );
                  })}
                </Fragment>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
