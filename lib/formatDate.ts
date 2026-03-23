/**
 * Shift-focused date/time display (PHASE 6).
 * Uses Europe/Berlin–consistent local parsing for YYYY-MM-DD + HH:MM fields from the DB.
 */

import type { Locale } from "./i18n";

export type AppLocale = "en" | "de";

/** Treasury balance timestamp: date only, no time (PHASE 8). */
export function formatTreasuryBalanceDate(iso: string | null | undefined, locale: Locale): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  const loc = locale === "en" ? "en-GB" : "de-DE";
  return new Intl.DateTimeFormat(loc, {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(d);
}

const BERLIN_TZ = "Europe/Berlin";

/**
 * ISO 8601 timestamp (e.g. due_at, created_at): date + time, Europe/Berlin (PHASE 9).
 */
export function formatLocaleDateTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  const loc = locale === "en" ? "en-GB" : "de-DE";
  return new Intl.DateTimeFormat(loc, {
    timeZone: BERLIN_TZ,
    dateStyle: "short",
    timeStyle: "short"
  }).format(d);
}

/**
 * ISO timestamp, date only (no time), Europe/Berlin — e.g. list columns for created_at.
 */
export function formatLocaleDateFromIso(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  const loc = locale === "en" ? "en-GB" : "de-DE";
  return new Intl.DateTimeFormat(loc, {
    timeZone: BERLIN_TZ,
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(d);
}

/**
 * DB calendar field YYYY-MM-DD (events, shifts) — no time-of-day shift (PHASE 9).
 */
export function formatCalendarDateYmd(ymd: string | null | undefined, locale: Locale): string {
  const s = String(ymd ?? "").trim().slice(0, 10);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || "–";
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "–";
  const loc = locale === "en" ? "en-GB" : "de-DE";
  return new Intl.DateTimeFormat(loc, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(d);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Parse shift date + time (DB: date + "HH:MM" or "HH:MM:SS") into a local Date for display. */
export function parseShiftDateTime(dateStr: string | null | undefined, timeStr: string | null | undefined): Date | null {
  const d = String(dateStr ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const raw = String(timeStr ?? "").trim();
  if (!raw) return new Date(`${d}T00:00:00`);
  const parts = raw.split(":");
  const hh = pad2(Number(parts[0] ?? 0));
  const mm = pad2(Number(parts[1] ?? 0));
  const ss = parts[2] != null && parts[2] !== "" ? pad2(Number(parts[2])) : "00";
  return new Date(`${d}T${hh}:${mm}:${ss}`);
}

/**
 * Tageszeitabhängige Begrüßung (ohne Emoji).
 */
export function getGreeting(locale: AppLocale = "de"): string {
  const hour = new Date().getHours();
  if (locale === "en") {
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }
  if (hour < 12) return "Guten Morgen";
  if (hour < 17) return "Guten Tag";
  return "Guten Abend";
}

function intlLocale(locale: AppLocale): string {
  return locale === "en" ? "en-GB" : "de-DE";
}

/**
 * Zwei Zeitpunkte (Start/Ende einer Schicht) als ein lesbarer String:
 * z. B. "Mo, 23.3., 09:00–11:00" (de) bzw. en-GB-Äquivalent.
 */
export function formatShiftTime(start: string | Date, end: string | Date, locale: AppLocale = "de"): string {
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "–";
  const loc = intlLocale(locale);
  const dateStr = new Intl.DateTimeFormat(loc, {
    timeZone: BERLIN_TZ,
    weekday: "short",
    day: "numeric",
    month: "numeric"
  }).format(s);
  const startTime = s.toLocaleTimeString(loc, { timeZone: BERLIN_TZ, hour: "2-digit", minute: "2-digit" });
  const endTime = e.toLocaleTimeString(loc, { timeZone: BERLIN_TZ, hour: "2-digit", minute: "2-digit" });
  return `${dateStr}, ${startTime}–${endTime}`;
}

/**
 * Schicht aus DB-Feldern `date`, `start_time`, `end_time`.
 */
export function formatShiftSlot(
  dateStr: string | null | undefined,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  locale: AppLocale = "de"
): string {
  const s = parseShiftDateTime(dateStr, startTime);
  const e = parseShiftDateTime(dateStr, endTime);
  if (!s || !e || Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "–";
  return formatShiftTime(s, e, locale);
}

/**
 * Nur Uhrzeit-Bereich (z. B. in Wochenansicht, wenn das Datum separat steht).
 */
export function formatShiftClockRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  locale: AppLocale = "de"
): string {
  const anchor = "2000-01-01";
  const s = parseShiftDateTime(anchor, startTime);
  const e = parseShiftDateTime(anchor, endTime);
  if (!s || !e) return "–";
  const loc = intlLocale(locale);
  return `${s.toLocaleTimeString(loc, { timeZone: BERLIN_TZ, hour: "2-digit", minute: "2-digit" })}–${e.toLocaleTimeString(loc, {
    timeZone: BERLIN_TZ,
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

/** Nächster Engagement-Meilenstein (Punkte) für Fortschrittsanzeige. */
export function nextEngagementMilestone(score: number): number {
  const steps = [10, 25, 50, 100, 250, 500, 1000];
  const found = steps.find((m) => m > score);
  return found ?? score + 10;
}
