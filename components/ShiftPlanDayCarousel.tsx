"use client";

import { useEffect, useRef, useState } from "react";
import { formatDateLabel, getTodayDateString } from "../lib/dateFormat";
import { formatShiftClockRange, type AppLocale } from "../lib/formatDate";
import { useLocale } from "./LocaleProvider";

export type ShiftSlot = {
  id: string;
  event_name: string;
  start_time: string;
  end_time: string;
  assignmentUserIds: string[];
};

export type DayData = {
  dateStr: string;
  weekdayName: string;
  weekdayLong: string;
  dayTitle: string | null;
  location: string | null;
  notes: string | null;
  shifts: ShiftSlot[];
  isToday: boolean;
};

const WEEKDAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function slotLabel(s: ShiftSlot, locale: AppLocale): string {
  const name = (s.event_name ?? "").trim();
  if (/1\.\s*Pause$/i.test(name)) return "1. Pause";
  if (/2\.\s*Pause$/i.test(name)) return "2. Pause";
  return formatShiftClockRange(s.start_time, s.end_time, locale);
}

function slotLabelDetail(s: ShiftSlot, locale: AppLocale): string {
  const name = (s.event_name ?? "").trim();
  const range = formatShiftClockRange(s.start_time, s.end_time, locale);
  if (/1\.\s*Pause$/i.test(name)) return `1. Pause (${range})`;
  if (/2\.\s*Pause$/i.test(name)) return `2. Pause (${range})`;
  return range.replace("–", " – ");
}

type Props = {
  days: DayData[];
  profileNames: Record<string, string>;
};

export default function ShiftPlanDayCarousel({ days, profileNames }: Props) {
  const { locale } = useLocale();
  const appLocale = locale as AppLocale;
  const [overlayDay, setOverlayDay] = useState<DayData | null>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);

  const getName = (userId: string) => {
    const full = profileNames[userId] ?? "";
    const first = full.split(" ")[0] || full || "–";
    return first;
  };

  useEffect(() => {
    if (hasScrolledToToday || !todayRef.current || !containerRef.current) return;
    todayRef.current.scrollIntoView({ behavior: "instant", block: "start" });
    setHasScrolledToToday(true);
  }, [hasScrolledToToday, days]);

  return (
    <>
      <div
        ref={containerRef}
        className="max-h-[60vh] overflow-y-auto rounded-lg border border-border-subtle bg-bg-secondary"
      >
        <div className="flex flex-col gap-3 p-3">
          {days.map((day) => {
            const hasShifts = day.shifts.length > 0;
            const content = (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className={`text-xs font-semibold shrink-0 ${
                      day.isToday ? "text-blue-600" : "text-text-secondary"
                    }`}
                  >
                    {day.weekdayName}{" "}
                    {day.dateStr.slice(8, 10)}.{day.dateStr.slice(5, 7)}
                    {day.dateStr.slice(0, 4) !== getTodayDateString().slice(0, 4)
                      ? "." + day.dateStr.slice(2, 4)
                      : ""}
                  </p>
                  {day.isToday && (
                    <span className="rounded bg-[var(--bg-brand-subtle)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-brand)]">
                      Heute
                    </span>
                  )}
                </div>
                {!hasShifts ? (
                  <p className="mt-1 text-[11px] text-text-muted">–</p>
                ) : (
                  <>
                    <div className="mt-1 border-t border-border-subtle pt-1.5 space-y-1">
                      {day.dayTitle && (
                        <p className="text-[10px] font-medium text-text-secondary line-clamp-2">
                          {day.dayTitle}
                        </p>
                      )}
                      {day.location && (
                        <p className="text-[10px] text-text-secondary">Ort: {day.location}</p>
                      )}
                      {day.notes && (
                        <p className="text-[10px] text-text-secondary line-clamp-2" title={day.notes}>
                          {day.notes}
                        </p>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      {day.shifts.map((s) => (
                        <div
                          key={s.id}
                          className="rounded bg-card/50 px-1.5 py-1 text-[10px]"
                        >
                          <span className="text-text-secondary">{slotLabel(s, appLocale)}</span>
                          <span className="ml-1 text-text-secondary">
                            {s.assignmentUserIds?.length > 0
                              ? s.assignmentUserIds.map(getName).join(", ")
                              : "–"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            );
            return (
              <div
                key={day.dateStr}
                ref={day.isToday ? todayRef : undefined}
                role={hasShifts ? "button" : undefined}
                tabIndex={hasShifts ? 0 : undefined}
                onClick={() => hasShifts && setOverlayDay(day)}
                onKeyDown={(e) =>
                  hasShifts && (e.key === "Enter" || e.key === " ") && setOverlayDay(day)
                }
                className={`min-w-0 rounded border p-3 flex flex-col text-left transition-colors ${
                  day.isToday
                    ? "border-[var(--color-brand)]/40 bg-[var(--bg-brand-subtle)] ring-1 ring-[var(--color-brand)]/20"
                    : "border-border-subtle bg-bg-primary"
                } ${hasShifts ? "cursor-pointer hover:bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-blue-500/50" : ""}`}
              >
                {content}
              </div>
            );
          })}
        </div>
      </div>

      {overlayDay && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOverlayDay(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Schichtdetails"
        >
          <div
            className="rounded-xl border border-border-subtle bg-bg-primary shadow-xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border-subtle bg-bg-secondary px-4 py-3 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-text-secondary">
                  {formatDateLabel(overlayDay.dateStr, { weekday: "long" })}
                </h3>
                {overlayDay.isToday && (
                  <span className="mt-1 inline-block rounded bg-[var(--bg-brand-subtle)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--color-brand-text)]">
                    Heute
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOverlayDay(null)}
                className="rounded p-1 text-text-secondary hover:bg-bg-secondary focus:outline-none"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              {overlayDay.dayTitle && (
                <p className="text-sm font-medium text-text-secondary">{overlayDay.dayTitle}</p>
              )}
              {overlayDay.location && (
                <p className="text-xs text-text-secondary">Ort: {overlayDay.location}</p>
              )}
              {overlayDay.notes && (
                <p className="text-xs text-text-secondary whitespace-pre-wrap">{overlayDay.notes}</p>
              )}
              <div className="pt-2 border-t border-border-subtle">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary mb-2">
                  Zeitfenster
                </p>
                <ul className="space-y-2">
                  {overlayDay.shifts.map((s) => (
                    <li
                      key={s.id}
                      className="rounded border border-border-subtle bg-bg-secondary px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-text-secondary">
                        {slotLabelDetail(s, appLocale)}
                      </span>
                      <p className="mt-1 text-text-secondary">
                        {s.assignmentUserIds?.length > 0
                          ? (s.assignmentUserIds ?? []).map((id) => profileNames[id] ?? id).join(", ")
                          : "–"}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
