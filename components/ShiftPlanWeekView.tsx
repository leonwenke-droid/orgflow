"use client";

import { useState } from "react";
import { formatDateLabel } from "../lib/dateFormat";

export type ShiftAssignment = {
  id: string;
  status: string;
  user_id: string | null;
  replacement_user_id: string | null;
};

export type ShiftSlot = {
  id: string;
  event_name: string;
  start_time: string;
  end_time: string;
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

function slotLabel(s: ShiftSlot): string {
  const name = (s.event_name ?? "").trim();
  if (/1\.\s*Pause$/i.test(name)) return "1. Pause";
  if (/2\.\s*Pause$/i.test(name)) return "2. Pause";
  return `${String(s.start_time).slice(0, 5)}–${String(s.end_time).slice(0, 5)}`;
}

function slotLabelDetail(s: ShiftSlot): string {
  const name = (s.event_name ?? "").trim();
  if (/1\.\s*Pause$/i.test(name))
    return `1. Pause (${String(s.start_time).slice(0, 5)} – ${String(s.end_time).slice(0, 5)})`;
  if (/2\.\s*Pause$/i.test(name))
    return `2. Pause (${String(s.start_time).slice(0, 5)} – ${String(s.end_time).slice(0, 5)})`;
  return `${String(s.start_time).slice(0, 5)} – ${String(s.end_time).slice(0, 5)}`;
}

type Props = {
  weeks: WeekData[];
  profileNames: Record<string, string>;
};

export default function ShiftPlanWeekView({ weeks, profileNames }: Props) {
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
    if (a.status === "abgesagt") return <span key={a.id} className="text-[10px]"><span className="text-red-400/90">✗ </span><span className={replacementName ? "text-red-200/80" : "line-through text-cyan-400/50"}>{name}</span>{replacementName && <span className="text-[9px] text-cyan-300/90"> ({replacementName})</span>}</span>;
    return <span key={a.id} className="text-[10px] text-amber-300/90">{name}</span>;
  };

  return (
    <>
      <div className="flex flex-col gap-8">
        {weeks.map(({ weekLabel, monday, days }) => (
          <div
            key={monday}
            className="rounded-lg border border-cyan-500/20 bg-card/30 p-3"
          >
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-cyan-400/90">
              Woche {weekLabel}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 min-w-0">
              {days.map((day) => {
                const hasShifts = day.shifts.length > 0;
                const content = (
                  <>
                    <p className="text-[11px] font-semibold text-cyan-400/90 shrink-0">
                      {day.weekdayName} {day.dateStr.slice(8, 10)}.{day.dateStr.slice(5, 7)}.
                    </p>
                    {!hasShifts ? (
                      <p className="mt-1 text-[11px] text-cyan-400/50">–</p>
                    ) : (
                      <>
                        <div className="mt-1 border-t border-cyan-500/15 pt-1.5 space-y-1">
                          {day.dayTitle && (
                            <p className="text-[10px] font-medium text-cyan-200/90 line-clamp-2">
                              {day.dayTitle}
                            </p>
                          )}
                          {day.location && (
                            <p className="text-[10px] text-cyan-400/70">Ort: {day.location}</p>
                          )}
                          {day.notes && (
                            <p className="text-[10px] text-cyan-200/70 line-clamp-2" title={day.notes}>
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
                              <span className="text-cyan-400">{slotLabel(s)}</span>
                              <div className="mt-0.5 ml-1 flex flex-wrap gap-x-1.5 gap-y-0.5 text-cyan-200 [&>span]:after:content-['·'] [&>span]:after:ml-1 [&>span]:after:text-cyan-500/60 [&>span:last-child]:after:content-none [&>span:last-child]:after:ml-0">
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
                    className={`min-w-0 rounded border border-cyan-500/15 bg-card/40 p-2 flex flex-col text-left ${
                      hasShifts ? "cursor-pointer hover:bg-card/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/50" : ""
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
            className="rounded-xl border border-cyan-500/30 bg-card shadow-xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-cyan-500/20 bg-card/80 px-4 py-3 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold text-cyan-400">
                {overlayDay.dateStr && formatDateLabel(overlayDay.dateStr, { weekday: "long" })}
              </h3>
              <button
                type="button"
                onClick={() => setOverlayDay(null)}
                className="rounded p-1 text-cyan-400 hover:bg-cyan-500/20 focus:outline-none"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              {overlayDay.dayTitle && (
                <p className="text-sm font-medium text-cyan-200">{overlayDay.dayTitle}</p>
              )}
              {overlayDay.location && (
                <p className="text-xs text-cyan-400/90">Ort: {overlayDay.location}</p>
              )}
              {overlayDay.notes && (
                <p className="text-xs text-cyan-200/90 whitespace-pre-wrap">{overlayDay.notes}</p>
              )}
              <div className="pt-2 border-t border-cyan-500/20">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-400/90 mb-2">
                  Zeitfenster
                </p>
                <ul className="space-y-2">
                  {overlayDay.shifts.map((s) => (
                    <li
                      key={s.id}
                      className="rounded border border-cyan-500/20 bg-card/40 px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-cyan-300">
                        {slotLabelDetail(s)}
                      </span>
                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-cyan-200/90 text-xs">
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
