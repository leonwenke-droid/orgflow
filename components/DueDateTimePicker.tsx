"use client";

import { useState } from "react";
import CalendarPicker from "./CalendarPicker";
import { getTodayDateString } from "../lib/dateFormat";

type Props = {
  name?: string;
  defaultValue?: string; // ISO or YYYY-MM-DDTHH:mm
  className?: string;
};

function parseDefault(val: string | undefined, todayStr: string): { date: string; time: string } {
  if (!val) {
    return { date: todayStr, time: "18:00" };
  }
  if (val.includes("T")) {
    const [d, t] = val.split("T");
    const timePart = t?.slice(0, 5) || "18:00";
    return { date: d?.slice(0, 10) || todayStr, time: timePart };
  }
  return { date: val.slice(0, 10), time: "18:00" };
}

export default function DueDateTimePicker({ name = "due_at", defaultValue, className = "" }: Props) {
  const todayStr = getTodayDateString();
  const parsed = parseDefault(defaultValue, todayStr);
  const [date, setDate] = useState(parsed.date);
  const [time, setTime] = useState(parsed.time);
  const [timeOverlayOpen, setTimeOverlayOpen] = useState(false);

  const dueAtValue = date && time ? `${date}T${time}` : "";
  const minDate = todayStr;

  return (
    <div className={className}>
      <input type="hidden" name={name} value={dueAtValue} readOnly />
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-cyan-400">Datum</label>
        <CalendarPicker
          defaultValue={date}
          min={minDate}
          omitHiddenInput
          onChange={setDate}
        />
      </div>
      <div className="mt-2">
        <label className="text-[11px] font-semibold text-cyan-400">Uhrzeit</label>
        <button
          type="button"
          onClick={() => setTimeOverlayOpen(true)}
          className="mt-1 w-full rounded border border-cyan-500/30 bg-card/60 px-3 py-2 text-left text-sm text-cyan-200 hover:bg-card/80"
        >
          {time || "18:00"}
        </button>
      </div>

      {timeOverlayOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setTimeOverlayOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Uhrzeit wählen"
        >
          <div
            className="rounded-xl border border-cyan-500/30 bg-card shadow-xl max-w-xs w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-cyan-500/20 bg-card/80 px-4 py-3">
              <h3 className="text-sm font-semibold text-cyan-400">Uhrzeit (Deadline)</h3>
            </div>
            <div className="p-4">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded border border-cyan-500/30 bg-card/60 p-2 text-sm text-cyan-200"
              />
            </div>
            <div className="border-t border-cyan-500/20 bg-card/80 px-4 py-3 flex justify-end">
              <button
                type="button"
                onClick={() => setTimeOverlayOpen(false)}
                className="rounded bg-cyan-500/30 px-4 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/50"
              >
                Fertig
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
