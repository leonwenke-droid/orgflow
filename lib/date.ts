import type { Locale } from "./i18n";

const BCP47: Record<Locale, string> = { en: "en-GB", de: "de-DE" };

/**
 * Short weekday names (Mon, Tue, … / Mo, Di, …) for the given locale.
 * Monday = index 0.
 */
export function getWeekdayNames(locale: Locale): string[] {
  const formatter = new Intl.DateTimeFormat(BCP47[locale], { weekday: "short" });
  const names: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(2024, 0, i); // Mon 1 Jan 2024, Tue 2 Jan, ...
    names.push(formatter.format(d));
  }
  return names;
}

/**
 * Month names (January, February, … / Januar, Februar, …) for the given locale.
 */
export function getMonthNames(locale: Locale): string[] {
  const formatter = new Intl.DateTimeFormat(BCP47[locale], { month: "long" });
  const names: string[] = [];
  for (let i = 0; i < 12; i++) {
    names.push(formatter.format(new Date(2024, i, 1)));
  }
  return names;
}

/**
 * Format a date string (YYYY-MM-DD) for display in the given locale.
 */
export function formatDateOnlyWithLocale(
  dateStr: string | null | undefined,
  locale: Locale
): string {
  const s = String(dateStr ?? "").trim().slice(0, 10);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || "–";
  const date = new Date(s + "T12:00:00Z");
  if (Number.isNaN(date.getTime())) return s;
  return date.toLocaleDateString(BCP47[locale], {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

/**
 * Format an ISO date-time string for display in the given locale.
 */
export function formatDateTimeWithLocale(
  isoString: string | null | undefined,
  locale: Locale
): string {
  if (!isoString || typeof isoString !== "string") return "–";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleString(BCP47[locale], { timeZone: "Europe/Berlin" });
}
