"use client";

import { useEffect, useRef, useState } from "react";
import { formatDateLabel, getTodayDateString } from "../lib/dateFormat";

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
  days: DayData[];
  profileNames: Record<string, string>;
};

export default function ShiftPlanDayCarousel({ days, profileNames }: Props) {
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
        className="max-h-[60vh] overflow-y-auto rounded-lg border border-cyan-500/20 bg-card/30"
      >
        <div className="flex flex-col gap-3 p-3">
          {days.map((day) => {
            const hasShifts = day.shifts.length > 0;
            const content = (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className={`text-xs font-semibold shrink-0 ${
                      day.isToday ? "text-cyan-300" : "text-cyan-400/90"
                    }`}
                  >
                    {day.weekdayName}{" "}
                    {day.dateStr.slice(8, 10)}.{day.dateStr.slice(5, 7)}
                    {day.dateStr.slice(0, 4) !== getTodayDateString().slice(0, 4)
                      ? "." + day.dateStr.slice(2, 4)
                      : ""}
                  </p>
                  {day.isToday && (
                    <span className="rounded bg-cyan-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-200">
                      Heute
                    </span>
                  )}
                </div>
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
                          <span className="ml-1 text-cyan-200">
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
                    ? "border-cyan-400/60 bg-cyan-500/10 ring-1 ring-cyan-400/30"
                    : "border-cyan-500/15 bg-card/40"
                } ${hasShifts ? "cursor-pointer hover:bg-card/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/50" : ""}`}
              >
                {content}
              </div>
            );
          })}
        </div>
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
            <div className="border-b border-cyan-500/20 bg-card/80 px-4 py-3 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-cyan-400">
                  {formatDateLabel(overlayDay.dateStr, { weekday: "long" })}
                </h3>
                {overlayDay.isToday && (
                  <span className="mt-1 inline-block rounded bg-cyan-500/30 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-200">
                    Heute
                  </span>
                )}
              </div>
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
                      <p className="mt-1 text-cyan-200/90">
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
