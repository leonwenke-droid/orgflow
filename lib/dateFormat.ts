const TODAY_TIMEZONE = "Europe/Berlin";

/**
 * Heute als YYYY-MM-DD in Europe/Berlin.
 * Einheitlich auf Server und Client, vermeidet Hydration-Fehler bei "Heute"-Anzeige.
 */
export function getTodayDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TODAY_TIMEZONE });
}

const WEEKDAY_SHORT = ["Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa.", "So."];
const WEEKDAY_LONG = [
  "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"
];

/**
 * Formatiert ein Datum (YYYY-MM-DD) für de-DE-Anzeige.
 * Eigenes Format (kein Intl für den kompletten String), damit Server und Client
 * exakt dasselbe ausgeben (vermeidet Hydration-Fehler wie "Fr.," vs "Fr.").
 */
export function formatDateLabel(
  dateStr: string | null | undefined,
  options: { weekday?: "short" | "long"; withYear?: boolean } = {}
): string {
  const s = String(dateStr ?? "").trim().slice(0, 10);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || "–";
  const date = new Date(s + "T12:00:00Z");
  if (Number.isNaN(date.getTime())) return s;
  const dayIndex = (date.getUTCDay() + 6) % 7;
  const weekday = options.weekday === "long"
    ? WEEKDAY_LONG[dayIndex]
    : WEEKDAY_SHORT[dayIndex];
  const datePart = formatDateOnly(s);
  return options.withYear === false ? `${weekday}, …` : `${weekday}, ${datePart}`;
}

/** Nur Tag/Monat/Jahr (z. B. "18.02.2026") ohne Wochentag. */
export function formatDateOnly(dateStr: string | null | undefined): string {
  const s = String(dateStr ?? "").trim().slice(0, 10);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || "–";
  const date = new Date(s + "T12:00:00Z");
  if (Number.isNaN(date.getTime())) return s;
  return date.toLocaleDateString("de-DE", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

/** Wochenbereich z. B. "01.02. – 07.02.2026" (UTC, hydration-sicher). */
export function formatWeekRangeLabel(mondayStr: string, sundayStr: string): string {
  const mon = formatDateOnly(mondayStr);
  const sun = formatDateOnly(sundayStr);
  return `${mon} – ${sun}`;
}

/**
 * ISO-Zeitstempel für Anzeige (z. B. "Letztes Update").
 * Feste Zeitzone Europe/Berlin, damit Server und Client dasselbe ausgeben.
 */
export function formatDateTimeForDisplay(isoString: string | null | undefined): string {
  if (!isoString || typeof isoString !== "string") return "–";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleString("de-DE", { timeZone: TODAY_TIMEZONE });
}
