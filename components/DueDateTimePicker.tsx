"use client";

import { useState } from "react";
import CalendarPicker from "./CalendarPicker";
import { getTodayDateString } from "../lib/dateFormat";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";

type Props = {
  name?: string;
  defaultValue?: string; // ISO or YYYY-MM-DDTHH:mm
  className?: string;
  /** Side-by-side date + time (e.g. new task form); avoids nested time overlay in modals */
  layout?: "stacked" | "inline";
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

export default function DueDateTimePicker({
  name = "due_at",
  defaultValue,
  className = "",
  layout = "stacked"
}: Props) {
  const { locale } = useLocale();
  const todayStr = getTodayDateString();
  const parsed = parseDefault(defaultValue, todayStr);
  const [date, setDate] = useState(parsed.date);
  const [time, setTime] = useState(parsed.time);
  const [timeOverlayOpen, setTimeOverlayOpen] = useState(false);

  const dueAtValue = date && time ? `${date}T${time}` : "";
  const minDate = todayStr;

  if (layout === "inline") {
    return (
      <div className={className}>
        <input type="hidden" name={name} value={dueAtValue} readOnly />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-secondary">{t("shifts.date", locale)}</label>
            <CalendarPicker
              defaultValue={date}
              min={minDate}
              omitHiddenInput
              onChange={setDate}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-secondary" htmlFor={`due-time-${name}`}>
              {t("tasks.time_label", locale)}
            </label>
            <input
              id={`due-time-${name}`}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="ui-input w-full p-2.5 text-sm"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <input type="hidden" name={name} value={dueAtValue} readOnly />
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary">{t("shifts.date", locale)}</label>
        <CalendarPicker
          defaultValue={date}
          min={minDate}
          omitHiddenInput
          onChange={setDate}
        />
      </div>
      <div className="mt-2">
        <label className="text-[11px] font-semibold text-text-secondary dark:text-text-secondary">{t("shifts.time_label", locale)}</label>
        <button
          type="button"
          onClick={() => setTimeOverlayOpen(true)}
          className="mt-1 w-full rounded border border-border-default bg-bg-primary px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary dark:border-border-default dark:bg-bg-primary dark:text-text-primary dark:hover:bg-bg-tertiary"
        >
          {time || "18:00"}
        </button>
      </div>

      {timeOverlayOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setTimeOverlayOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t("tasks.time_label", locale)}
        >
          <div
            className="max-w-xs w-full overflow-hidden rounded-xl border border-border-subtle bg-bg-primary shadow-xl dark:border-border-default dark:bg-bg-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border-subtle bg-bg-secondary px-4 py-3 dark:border-border-default dark:bg-bg-primary">
              <h3 className="text-sm font-semibold text-text-primary dark:text-text-primary">{t("tasks.time_deadline", locale)}</h3>
            </div>
            <div className="p-4">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded border border-border-default bg-bg-primary p-2 text-sm text-text-primary dark:border-border-default dark:bg-bg-primary dark:text-text-primary"
              />
            </div>
            <div className="flex justify-end border-t border-border-subtle bg-bg-secondary px-4 py-3 dark:border-border-default dark:bg-bg-primary">
              <button
                type="button"
                onClick={() => setTimeOverlayOpen(false)}
                className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {t("common.done", locale)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
