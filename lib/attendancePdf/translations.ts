import type { AttendancePdfLocale } from "./types";

export type { AttendancePdfLocale } from "./types";

const en = {
  brand: "OrgFlow",
  title: "Attendance Report",
  subtitle: "Shift attendance & sign-off",
  organisation: "Organisation",
  event: "Event",
  period: "Period",
  exported: "Exported",
  urlSlug: "URL short name",

  present: "Present",
  pending: "Pending",
  absent: "Absent",
  cancelled: "Cancelled",
  open: "Open",
  openSlot: "Open slot",

  name: "Name",
  role: "Role",
  status: "Status",
  checkin: "Check-in",

  slotsFilled: "{filled}/{total} filled",

  confirmed: "Confirmed by team lead / organiser",
  signature: "Signature & Name",
  sigDateTime: "Date & time",
  sigCaptionDate: "Date",
  date: "Date",

  legendPillPresentDone: "✓ Present / Done",
  legendPillPendingInvited: "~ Pending / Invited",
  legendPillAbsentCancelled: "✗ Absent / Cancelled",
  legendPillOpenSlot: "– Open slot",

  replacementPrefix: "Replacement",

  pageFooter: "Page {n} of {total}",
  footerBrandSuffix: "· Attendance Report"
} as const;

const de = {
  brand: "OrgFlow",
  title: "Anwesenheitsbericht",
  subtitle: "Schicht-Anwesenheit & Bestätigung",
  organisation: "Organisation",
  event: "Veranstaltung",
  period: "Zeitraum",
  exported: "Exportiert",
  urlSlug: "Kurzname (URL)",

  present: "Anwesend",
  pending: "Ausstehend",
  absent: "Abwesend",
  cancelled: "Abgesagt",
  open: "Offen",
  openSlot: "Freier Platz",

  name: "Name",
  role: "Rolle",
  status: "Status",
  checkin: "Check-in",

  slotsFilled: "{filled}/{total} belegt",

  confirmed: "Bestätigt durch Teamleitung / Organisation",
  signature: "Unterschrift & Name",
  sigDateTime: "Datum & Uhrzeit",
  sigCaptionDate: "Datum",
  date: "Datum",

  legendPillPresentDone: "✓ Anwesend / Erledigt",
  legendPillPendingInvited: "~ Ausstehend / Eingeladen",
  legendPillAbsentCancelled: "✗ Abwesend / Abgesagt",
  legendPillOpenSlot: "– Freier Platz",

  replacementPrefix: "Ersatz",

  pageFooter: "Seite {n} von {total}",
  footerBrandSuffix: "· Anwesenheitsbericht"
} as const;

/**
 * Single source of truth for PDF copy. Add languages by extending this object.
 */
export const attendanceTranslations = { en, de } as unknown as Record<AttendancePdfLocale, typeof en>;

export type AttendanceTranslationKey = keyof typeof en;

export function getAttendanceT(locale: AttendancePdfLocale) {
  return attendanceTranslations[locale];
}
