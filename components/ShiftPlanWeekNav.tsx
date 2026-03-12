"use client";

import { useRef, useState, useEffect } from "react";
import html2canvas from "html2canvas";
import type { WeekData, DayData, ShiftSlot, ShiftAssignment } from "./ShiftPlanWeekView";
import { formatDateLabel, getTodayDateString } from "../lib/dateFormat";

function formatAssignments(
  assignments: ShiftAssignment[] | undefined,
  profileNames: Record<string, string>
): React.ReactNode {
  if (!assignments?.length) return "–";
  return (
    <span className="inline-flex flex-wrap gap-x-1.5 gap-y-0.5 text-[10px]">
      {assignments.map((a, i) => {
        const name = a.user_id ? (profileNames[a.user_id] ?? "–") : "–";
        const rep = a.replacement_user_id ? (profileNames[a.replacement_user_id] ?? "–") : null;
        let inner: React.ReactNode;
        if (a.status === "erledigt") inner = <span className="text-green-600">✓ {name}</span>;
        else if (a.status === "abgesagt") inner = <><span className="text-red-500">✗ </span><span className={rep ? "text-red-600" : "line-through text-gray-400"}>{name}</span>{rep ? <span className="text-gray-600"> ({rep})</span> : null}</>;
        else inner = <span className="text-amber-600">{name}</span>;
        return <span key={a.id}>{i > 0 && <span className="mx-0.5 text-gray-400">·</span>}{inner}</span>;
      })}
    </span>
  );
}

function formatAssignmentsPlain(
  assignments: ShiftAssignment[] | undefined,
  profileNames: Record<string, string>
): string {
  if (!assignments?.length) return "–";
  return assignments.map((a) => {
    const name = a.user_id ? (profileNames[a.user_id] ?? "–") : "–";
    const rep = a.replacement_user_id ? (profileNames[a.replacement_user_id] ?? "–") : null;
    if (a.status === "erledigt") return `✓ ${name}`;
    if (a.status === "abgesagt") return rep ? `✗ ${name} (${rep})` : `✗ ${name}`;
    return name;
  }).join(" · ");
}

function downloadCanvas(canvas: HTMLCanvasElement, dateStr: string, format: "png" | "jpeg") {
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const ext = format === "png" ? "png" : "jpg";
  const link = document.createElement("a");
  link.download = `Schichtplan-${dateStr}.${ext}`;
  link.href = canvas.toDataURL(mime, format === "jpeg" ? 0.92 : undefined);
  link.click();
}

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

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

type Props = {
  weeks: WeekData[];
  currentWeekIndex: number;
  profileNames: Record<string, string>;
};

export default function ShiftPlanWeekNav({
  weeks,
  currentWeekIndex,
  profileNames
}: Props) {
  const safeIndex = Math.max(0, Math.min(currentWeekIndex, weeks.length - 1));
  const [weekIndex, setWeekIndex] = useState(safeIndex);
  const todayStr = getTodayDateString();
  const getTodayDayIndex = (w: WeekData) => w.days.findIndex((d) => d.dateStr === todayStr);
  const [dayIndex, setDayIndex] = useState(() => {
    const w = weeks[Math.max(0, Math.min(currentWeekIndex, weeks.length - 1))];
    if (!w) return 0;
    const idx = getTodayDayIndex(w);
    return idx >= 0 ? idx : 0;
  });
  const [overlayDay, setOverlayDay] = useState<DayData | null>(null);
  const [exportDay, setExportDay] = useState<DayData | null>(null);
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg">("png");
  const overlayCardRef = useRef<HTMLDivElement>(null);
  const exportDivRef = useRef<HTMLDivElement>(null);

  const week = weeks[weekIndex];
  const canGoLeft = weekIndex > 0;
  const canGoRight = weekIndex < weeks.length - 1;

  useEffect(() => {
    const w = weeks[weekIndex];
    if (!w) return;
    const idx = w.days.findIndex((d) => d.dateStr === todayStr);
    setDayIndex((prev) => (idx >= 0 ? idx : Math.min(prev, w.days.length - 1)));
  }, [weekIndex, weeks, todayStr]);

  useEffect(() => {
    if (!exportDay) return;
    const el = exportDivRef.current;
    if (!el) {
      setExportDay(null);
      return;
    }
    const timer = setTimeout(() => {
      html2canvas(el, {
        backgroundColor: "#1e293b",
        scale: 2,
        logging: false
      })
        .then((canvas) => {
          downloadCanvas(canvas, exportDay.dateStr, exportFormat);
          setExportDay(null);
        })
        .catch(() => setExportDay(null));
    }, 100);
    return () => clearTimeout(timer);
  }, [exportDay, exportFormat]);

  const captureOverlayAsImage = (format: "png" | "jpeg") => {
    if (!overlayCardRef.current) return;
    html2canvas(overlayCardRef.current, {
      backgroundColor: "#1e293b",
      scale: 2,
      logging: false
    }).then((canvas) => {
      if (overlayDay) downloadCanvas(canvas, overlayDay.dateStr, format);
    });
  };

  if (!week) {
    return (
      <p className="text-xs text-gray-500">No shifts in this period.</p>
    );
  }

  const { weekLabel, days } = week;
  const currentDay = days[Math.max(0, Math.min(dayIndex, days.length - 1))];
  const lastDayIndex = days.length - 1;
  const canDayLeft = dayIndex > 0 || (dayIndex === 0 && canGoLeft);
  const canDayRight = dayIndex < lastDayIndex || (dayIndex === lastDayIndex && canGoRight);

  const renderDayCard = (day: DayData) => {
    const isToday = day.dateStr === todayStr;
    const hasShifts = day.shifts.length > 0;
    return (
      <>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <p className={`text-[11px] font-semibold ${isToday ? "text-blue-600" : "text-gray-600"}`}>
            {day.weekdayName} {day.dateStr.slice(8, 10)}.{day.dateStr.slice(5, 7)}.
          </p>
          {isToday && (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-600">
              Heute
            </span>
          )}
        </div>
        {!hasShifts ? (
          <p className="mt-1 text-[11px] text-gray-400">–</p>
        ) : (
          <>
            <div className="mt-1 space-y-1 border-t border-gray-100 pt-1.5">
              {day.dayTitle && (
                <p className="line-clamp-2 text-[10px] font-medium text-gray-700">
                  {day.dayTitle}</p>
              )}
              {day.location && (
                <p className="text-[10px] text-gray-500">Ort: {day.location}</p>
              )}
              {day.notes && (
                <p className="line-clamp-2 text-[10px] text-gray-600" title={day.notes}>
                  {day.notes}</p>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {day.shifts.map((s) => (
                <div key={s.id} className="rounded bg-gray-50 px-1.5 py-1 text-[10px]">
                  <span className="text-gray-700">{slotLabel(s)}</span>
                  <div className="ml-1 text-gray-600">
                    {s.assignments?.length > 0
                      ? formatAssignments(s.assignments, profileNames)
                      : "–"}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </>
    );
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
          disabled={!canGoLeft}
          className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Vorherige Woche"
        >
          ←
        </button>
        <h3 className="flex-1 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">
          Woche {weekLabel}
        </h3>
        <button
          type="button"
          onClick={() => setWeekIndex((i) => Math.min(weeks.length - 1, i + 1))}
          disabled={!canGoRight}
          className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Nächste Woche"
        >
          →
        </button>
      </div>

      {/* Mobil: nur ein Tag, mit Pfeilen – übersichtliche Einzelansicht */}
      <div className="mt-4 md:hidden space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (dayIndex > 0) setDayIndex((i) => i - 1);
              else if (canGoLeft) {
                setWeekIndex((i) => i - 1);
                setDayIndex(lastDayIndex);
              }
            }}
            disabled={!canDayLeft}
            className="shrink-0 rounded-xl border border-gray-300 bg-white p-3 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
            aria-label="Vorheriger Tag"
          >
            ←
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-base font-semibold text-gray-900">
              {currentDay && formatDateLabel(currentDay.dateStr, { weekday: "long" })}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {currentDay && `${currentDay.dateStr.slice(8, 10)}.${currentDay.dateStr.slice(5, 7)}.${currentDay.dateStr.slice(0, 4)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (dayIndex < lastDayIndex) setDayIndex((i) => i + 1);
              else if (canGoRight) {
                setWeekIndex((i) => i + 1);
                setDayIndex(0);
              }
            }}
            disabled={!canDayRight}
            className="shrink-0 rounded-xl border border-gray-300 bg-white p-3 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
            aria-label="Next day"
          >
            →
          </button>
        </div>
        {currentDay && (
          <div
            role={currentDay.shifts.length > 0 ? "button" : undefined}
            tabIndex={currentDay.shifts.length > 0 ? 0 : undefined}
            onClick={() => currentDay.shifts.length > 0 && setOverlayDay(currentDay)}
            onKeyDown={(e) =>
              currentDay.shifts.length > 0 && (e.key === "Enter" || e.key === " ") && setOverlayDay(currentDay)
            }
            className={`relative flex flex-col rounded-xl border-2 p-4 text-left ${
              currentDay.dateStr === todayStr
                ? "border-blue-400 bg-blue-50/50 ring-2 ring-blue-200"
                : "border-gray-200 bg-white"
            } ${currentDay.shifts.length > 0 ? "cursor-pointer active:bg-gray-50" : ""}`}
          >
            {currentDay.dateStr === todayStr && (
              <span className="absolute right-12 top-3 rounded-md bg-blue-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-600">
                Heute
              </span>
            )}
            {currentDay.shifts.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExportFormat("png");
                  setExportDay(currentDay);
                }}
                className="absolute right-3 top-3 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 touch-manipulation"
                title="Als Bild herunterladen"
                aria-label="Als Bild herunterladen"
              >
                <DownloadIcon />
              </button>
            )}

            {!currentDay.shifts.length ? (
              <p className="py-2 text-sm text-gray-500">No shifts entered.</p>
            ) : (
              <div className="space-y-4">
                {(currentDay.dayTitle || currentDay.location || currentDay.notes) && (
                  <div className="space-y-1.5 border-b border-gray-200 pb-3">
                    {currentDay.dayTitle && (
                      <p className="text-sm font-medium text-gray-900">{currentDay.dayTitle}</p>
                    )}
                    {currentDay.location && (
                      <p className="text-xs text-gray-600">📍 {currentDay.location}</p>
                    )}
                    {currentDay.notes && (
                      <p className="leading-snug text-xs text-gray-600" title={currentDay.notes}>
                        {currentDay.notes}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Shifts
                  </p>
                  <ul className="space-y-2">
                    {currentDay.shifts.map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-col gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
                      >
                        <span className="text-xs font-semibold text-gray-700">
                          {slotLabel(s)}
                        </span>
                        <div className="text-sm text-gray-600">
                          {s.assignments?.length > 0
                            ? formatAssignments(s.assignments, profileNames)
                            : "–"}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Desktop: Woche als Grid (7 Tage) */}
      <div className="mt-3 hidden md:grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 min-w-0">
        {days.map((day) => {
          const hasShifts = day.shifts.length > 0;
          return (
            <div
              key={day.dateStr}
              role={hasShifts ? "button" : undefined}
              tabIndex={hasShifts ? 0 : undefined}
              onClick={() => hasShifts && setOverlayDay(day)}
              onKeyDown={(e) =>
                hasShifts && (e.key === "Enter" || e.key === " ") && setOverlayDay(day)
              }
              className={`relative flex min-w-0 flex-col rounded border p-2 text-left ${
                day.dateStr === todayStr
                  ? "border-blue-300 bg-blue-50/50 ring-1 ring-blue-200"
                  : "border-gray-200 bg-gray-50"
              } ${hasShifts ? "cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-300" : ""}`}
            >
              {renderDayCard(day)}
              {hasShifts && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExportFormat("png");
                    setExportDay(day);
                  }}
                  className="absolute right-1.5 top-1.5 rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 focus:outline-none"
                  title="Als Bild herunterladen (PNG)"
                  aria-label="Als Bild herunterladen"
                >
                  <DownloadIcon />
                </button>
              )}
            </div>
          );
        })}
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
            ref={overlayCardRef}
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {overlayDay.dateStr && formatDateLabel(overlayDay.dateStr, { weekday: "long" })}
                </h3>
                {overlayDay.dateStr === getTodayDateString() && (
                  <span className="mt-1 inline-block rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-600">
                    Heute
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="mr-1 text-[10px] text-gray-500">Download:</span>
                <button
                  type="button"
                  onClick={() => captureOverlayAsImage("png")}
                  className="rounded px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-200 focus:outline-none"
                >
                  PNG
                </button>
                <button
                  type="button"
                  onClick={() => captureOverlayAsImage("jpeg")}
                  className="rounded px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-200 focus:outline-none"
                >
                  JPG
                </button>
                <button
                  type="button"
                  onClick={() => setOverlayDay(null)}
                  className="rounded p-1 text-gray-600 hover:bg-gray-200 focus:outline-none"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="space-y-3 overflow-y-auto p-4">
              {overlayDay.dayTitle && (
                <p className="text-sm font-medium text-gray-900">{overlayDay.dayTitle}</p>
              )}
              {overlayDay.location && (
                <p className="text-xs text-gray-600">Ort: {overlayDay.location}</p>
              )}
              {overlayDay.notes && (
                <p className="whitespace-pre-wrap text-xs text-gray-600">{overlayDay.notes}</p>
              )}
              <div className="border-t border-gray-200 pt-2">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Zeitfenster
                </p>
                <ul className="space-y-2">
                  {overlayDay.shifts.map((s) => (
                    <li
                      key={s.id}
                      className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-gray-700">{slotLabelDetail(s)}</span>
                      <p className="mt-1 text-gray-600">
                        {formatAssignmentsPlain(s.assignments, profileNames)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {exportDay && (
        <div
          ref={exportDivRef}
          className="fixed left-[-9999px] top-0 w-[400px] rounded-xl border border-blue-500/30 bg-slate-800 p-4 text-left"
          style={{ color: "rgb(207 250 254)", fontFamily: "inherit" }}
        >
          <h3 className="text-base font-semibold text-blue-400 border-b border-blue-500/20 pb-2 mb-3">
            {formatDateLabel(exportDay.dateStr, { weekday: "long" })}
          </h3>
          {exportDay.dayTitle && (
            <p className="text-sm font-medium text-blue-200 mb-1">{exportDay.dayTitle}</p>
          )}
          {exportDay.location && (
            <p className="text-xs text-blue-400/90 mb-1">Ort: {exportDay.location}</p>
          )}
          {exportDay.notes && (
            <p className="text-xs text-blue-200/90 whitespace-pre-wrap mb-3">{exportDay.notes}</p>
          )}
          <div className="pt-2 border-t border-blue-500/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-400/90 mb-2">
              Zeitfenster
            </p>
            <ul className="space-y-2">
              {exportDay.shifts.map((s) => (
                <li
                  key={s.id}
                  className="rounded border border-blue-500/20 bg-slate-700/50 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-blue-300">{slotLabelDetail(s)}</span>
                  <p className="mt-1 text-blue-200/90">
                    {formatAssignmentsPlain(s.assignments, profileNames)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
