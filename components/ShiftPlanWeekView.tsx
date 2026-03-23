"use client";

import { useState } from "react";
import { formatDateLabel } from "../lib/dateFormat";
import { formatShiftClockRange, type AppLocale } from "../lib/formatDate";
import { useLocale } from "./LocaleProvider";

export type ShiftAssignment = {
  id: string;
  status: string;
  user_id: string | null;
  replacement_user_id: string | null;
  swap_offered?: boolean;
};

export type ShiftSlot = {
  id: string;
  event_name: string;
  start_time: string;
  end_time: string;
  required_slots?: number;
  claimable?: boolean;
  auto_assign?: boolean;
  assignments: ShiftAssignment[];
};

export type DayData = {
  dateStr: string;
  weekdayName: string;
  dayTitle: string | null;
  location: string | null;
  notes: string | null;
  shifts: ShiftSlot[];
};

export type WeekData = {
  weekLabel: string;
  monday: string;
  days: DayData[];
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
  weeks: WeekData[];
  profileNames: Record<string, string>;
};

export default function ShiftPlanWeekView({ weeks, profileNames }: Props) {
  const { locale } = useLocale();
  const appLocale = locale as AppLocale;
  const [overlayDay, setOverlayDay] = useState<DayData | null>(null);

  const getName = (userId: string) => {
    const full = profileNames[userId] ?? "";
    const first = full.split(" ")[0] || full || "–";
    return first;
  };

  const renderAssignment = (a: ShiftAssignment) => {
    const name = a.user_id ? getName(a.user_id) : "–";
    const replacementName = a.replacement_user_id ? getName(a.replacement_user_id) : null;
    if (a.status === "erledigt") return <span key={a.id} className="text-[10px] text-green-300/90">✓ {name}</span>;
    if (a.status === "abgesagt") return <span key={a.id} className="text-[10px]"><span className="text-red-600">✗ </span><span className={replacementName ? "text-red-600/90" : "line-through text-gray-500"}>{name}</span>{replacementName && <span className="text-[9px] text-gray-600"> ({replacementName})</span>}</span>;
    return <span key={a.id} className="text-[10px] text-amber-300/90">{name}</span>;
  };

  return (
    <>
      <div className="flex flex-col gap-8">
        {weeks.map(({ weekLabel, monday, days }) => (
          <div
            key={monday}
            className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-800/60"
          >
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
              Woche {weekLabel}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 min-w-0">
              {days.map((day) => {
                const hasShifts = day.shifts.length > 0;
                const content = (
                  <>
                    <p className="text-[11px] font-semibold text-gray-700 shrink-0 dark:text-gray-100">
                      {day.weekdayName} {day.dateStr.slice(8, 10)}.{day.dateStr.slice(5, 7)}.
                    </p>
                    {!hasShifts ? (
                      <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">–</p>
                    ) : (
                      <>
                        <div className="mt-1 border-t border-gray-200 pt-1.5 space-y-1 dark:border-gray-600">
                          {day.dayTitle && (
                            <p className="text-[10px] font-medium text-gray-600 line-clamp-2 dark:text-gray-300">
                              {day.dayTitle}
                            </p>
                          )}
                          {day.location && (
                            <p className="text-[10px] text-gray-600 dark:text-gray-400">Ort: {day.location}</p>
                          )}
                          {day.notes && (
                            <p className="text-[10px] text-gray-600 line-clamp-2 dark:text-gray-400" title={day.notes}>
                              {day.notes}
                            </p>
                          )}
                        </div>
                        <div className="mt-2 space-y-1">
                          {day.shifts.map((s) => (
                            <div
                              key={s.id}
                              className="rounded bg-card/50 px-1.5 py-1 text-[10px] dark:bg-gray-900/50"
                            >
                              <span className="text-gray-700 dark:text-gray-200">{slotLabel(s, appLocale)}</span>
                              <div className="mt-0.5 ml-1 flex flex-wrap gap-x-1.5 gap-y-0.5 text-gray-600 dark:text-gray-400 [&>span]:after:content-['·'] [&>span]:after:ml-1 [&>span]:after:text-gray-400 [&>span:last-child]:after:content-none [&>span:last-child]:after:ml-0">
                                {s.assignments?.length > 0
                                  ? s.assignments.map(renderAssignment)
                                  : "–"}
                              </div>
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
                    role={hasShifts ? "button" : undefined}
                    tabIndex={hasShifts ? 0 : undefined}
                    onClick={() => hasShifts && setOverlayDay(day)}
                    onKeyDown={(e) =>
                      hasShifts && (e.key === "Enter" || e.key === " ") && setOverlayDay(day)
                    }
                    className={`min-w-0 rounded border border-gray-200 bg-white p-2 flex flex-col text-left dark:border-gray-600 dark:bg-gray-800/90 dark:text-gray-100 ${
                      hasShifts
                        ? "cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500/50 dark:hover:bg-gray-700/80"
                        : ""
                    }`}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {overlayDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOverlayDay(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Schichtdetails"
        >
          <div
            className="rounded-xl border border-gray-200 bg-white shadow-xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col dark:border-gray-600 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between shrink-0 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-100">
                {overlayDay.dateStr && formatDateLabel(overlayDay.dateStr, { weekday: "long" })}
              </h3>
              <button
                type="button"
                onClick={() => setOverlayDay(null)}
                className="rounded p-1 text-gray-600 hover:bg-gray-100 focus:outline-none dark:text-gray-300 dark:hover:bg-gray-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              {overlayDay.dayTitle && (
                <p className="text-sm font-medium text-gray-700 dark:text-gray-100">{overlayDay.dayTitle}</p>
              )}
              {overlayDay.location && (
                <p className="text-xs text-gray-600 dark:text-gray-400">Ort: {overlayDay.location}</p>
              )}
              {overlayDay.notes && (
                <p className="text-xs text-gray-600 whitespace-pre-wrap dark:text-gray-400">{overlayDay.notes}</p>
              )}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 mb-2 dark:text-gray-300">
                  Zeitfenster
                </p>
                <ul className="space-y-2">
                  {overlayDay.shifts.map((s) => (
                    <li
                      key={s.id}
                      className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-800/80"
                    >
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        {slotLabelDetail(s, appLocale)}
                      </span>
                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-gray-600 text-xs dark:text-gray-400">
                        {s.assignments?.length > 0
                          ? s.assignments.map((a) => {
                              const name = a.user_id ? (profileNames[a.user_id] ?? a.user_id) : "–";
                              const rep = a.replacement_user_id ? (profileNames[a.replacement_user_id] ?? a.replacement_user_id) : null;
                              if (a.status === "erledigt") return <span key={a.id}>✓ {name}</span>;
                              if (a.status === "abgesagt") return <span key={a.id}>✗ <span className={rep ? "" : "line-through opacity-60"}>{name}</span>{rep ? <span className="opacity-90"> ({rep})</span> : null}</span>;
                              return <span key={a.id}>{name}</span>;
                            })
                          : "–"}
                      </div>
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
