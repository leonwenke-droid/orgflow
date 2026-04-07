/**
 * Data model for the attendance PDF (single template, locale via translations).
 */

export type AttendancePdfLocale = "de" | "en";

/** Normalized assignment row for PDF table */
export type AttendanceAssignmentRow = {
  name: string;
  role: string | null;
  /** Drives symbol + label */
  statusKind: "present" | "pending" | "absent" | "cancelled" | "open";
  replacementName?: string | null;
  checkInDisplay: string | null;
};

export type AttendanceShiftSection = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  requiredSlots: number;
  filledCount: number;
  /** Slot summary e.g. "5/5" for translation "5/5 filled" */
  slotsLabel: string;
  rows: AttendanceAssignmentRow[];
};

export type AttendanceDayGroup = {
  /** YYYY-MM-DD */
  date: string;
  /** Long formatted date headline (locale-aware, precomputed server-side) */
  dateHeadline: string;
  eventTitle: string;
  location: string | null;
  shifts: AttendanceShiftSection[];
};

export type AttendanceReport = {
  organisation: string;
  organisationSlug: string | null;
  /** Optional document-wide event title (header “Event” line); omit or null → "—" */
  documentEventTitle: string | null;
  /** ISO period bounds used for export */
  periodFrom: string;
  periodTo: string;
  /** Pre-formatted period line for header */
  periodDisplay: string;
  /** ISO-ish exported timestamp for header */
  exportedAtDisplay: string;
  days: AttendanceDayGroup[];
};
