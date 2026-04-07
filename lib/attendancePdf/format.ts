import type { AttendancePdfLocale } from "./types";

export function formatDateLong(dateStr: string, locale: AttendancePdfLocale): string {
  const s = String(dateStr ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return dateStr;
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(s + "T12:00:00Z"));
}

export function formatTimeShort(time: string | null | undefined): string {
  const t = String(time ?? "").trim();
  return t.slice(0, 5) || "—";
}

export function formatPeriodRange(from: string, to: string, locale: AttendancePdfLocale): string {
  const a = from.slice(0, 10);
  const b = to.slice(0, 10);
  const fmt = (d: string) =>
    new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { dateStyle: "medium" }).format(
      new Date(d + "T12:00:00Z")
    );
  if (a === b) return fmt(a);
  return `${fmt(a)} – ${fmt(b)}`;
}

export function formatExportedAt(locale: AttendancePdfLocale): string {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date());
}

export function formatCheckIn(
  checkedInAt: string | null | undefined,
  method: string | null | undefined,
  locale: AttendancePdfLocale
): string | null {
  if (!checkedInAt) return null;
  const d = new Date(checkedInAt);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString(locale === "de" ? "de-DE" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  });
  const m = method === "manual" ? (locale === "de" ? "manuell" : "manual") : "QR";
  return `${time} · ${m}`;
}
