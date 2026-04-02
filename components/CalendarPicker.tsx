"use client";

import { useMemo, useState } from "react";
import { getTodayDateString } from "../lib/dateFormat";
import { useLocale } from "./LocaleProvider";
import { t } from "../lib/i18n";
import { getWeekdayNames, getMonthNames } from "../lib/date";

function getDaysInMonth(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();
  // Montag = 0 (getDay() Sonntag = 0, also Mo = 1 -> -1 mod 7)
  const firstWeekday = (first.getDay() + 6) % 7;
  return { daysInMonth, firstWeekday };
}

function toYYYYMMDD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type Props = {
  name?: string;
  defaultValue?: string; // YYYY-MM-DD
  required?: boolean;
  min?: string; // YYYY-MM-DD
  className?: string;
  /** Wenn gesetzt: kein hidden input, stattdessen wird bei Änderung aufgerufen */
  onChange?: (dateYYYYMMDD: string) => void;
  omitHiddenInput?: boolean;
};

export default function CalendarPicker({
  name = "date",
  defaultValue,
  required,
  min,
  className = "",
  onChange,
  omitHiddenInput = false
}: Props) {
  const { locale } = useLocale();
  const WEEKDAYS = useMemo(() => getWeekdayNames(locale), [locale]);
  const MONTHS = useMemo(() => getMonthNames(locale), [locale]);
  const todayStr = useMemo(() => getTodayDateString(), []);
  const todayYMD = useMemo(() => {
    const [y, m, d] = todayStr.split("-").map(Number);
    return { y: y ?? 0, m: (m ?? 1) - 1, d: d ?? 1 };
  }, [todayStr]);
  const [viewDate, setViewDate] = useState(() => {
    if (defaultValue) {
      const [y, m, d] = defaultValue.split("-").map(Number);
      return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
    }
    return new Date(todayYMD.y, todayYMD.m, todayYMD.d);
  });
  const [selected, setSelected] = useState<string | null>(
    defaultValue ?? todayStr
  );

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const { daysInMonth, firstWeekday } = getDaysInMonth(year, month);

  const minDate = min ? (() => {
    const [y, m, d] = min.split("-").map(Number);
    return new Date(y, m - 1, d);
  })() : null;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const isDisabled = (day: number) => {
    if (!minDate) return false;
    const d = new Date(year, month, day);
    return d < minDate;
  };

  const select = (day: number) => {
    if (isDisabled(day)) return;
    const value = toYYYYMMDD(new Date(year, month, day));
    setSelected(value);
    onChange?.(value);
  };

  return (
    <div className={`rounded-lg border border-border-default bg-bg-primary p-3 dark:border-border-default dark:bg-bg-primary ${className}`}>
      {!omitHiddenInput && (
        <input
          type="hidden"
          name={name}
          value={selected ?? ""}
          required={required}
          readOnly
        />
      )}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded p-1 text-text-secondary transition-colors hover:bg-bg-secondary dark:text-text-muted dark:hover:bg-bg-tertiary"
          aria-label={t("calendar.prev_month", locale)}
        >
          ‹
        </button>
        <span className="text-xs font-semibold text-text-primary dark:text-text-primary">
          {MONTHS[month]} {year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded p-1 text-text-secondary transition-colors hover:bg-bg-secondary dark:text-text-muted dark:hover:bg-bg-tertiary"
          aria-label={t("calendar.next_month", locale)}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="py-0.5 text-[10px] font-medium text-text-secondary dark:text-text-muted">
            {wd}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const value = toYYYYMMDD(new Date(year, month, day));
          const disabled = isDisabled(day);
          const isSelected = selected === value;
          return (
            <button
              key={day}
              type="button"
              onClick={() => select(day)}
              disabled={disabled}
              className={`rounded py-1 text-xs ${
                disabled
                  ? "cursor-not-allowed text-text-secondary"
                  : isSelected
                    ? "bg-blue-600 text-white"
                    : "text-text-secondary hover:bg-bg-secondary dark:text-text-secondary dark:hover:bg-bg-tertiary"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
