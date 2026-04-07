/**
 * Shared types for client-side attendance PDF (jsPDF) — OrgFlow_AttendancePDF_Implementation.md
 */

export type AttendanceStatus =
  | "present"
  | "done"
  | "pending"
  | "invited"
  | "absent"
  | "cancelled"
  | "excused"
  | "open";

export interface AttendancePerson {
  name: string;
  role?: string;
  status: AttendanceStatus;
  /** e.g. "07:02" or null */
  checkin_time?: string | null;
}

export interface AttendanceShift {
  time_from: string;
  time_to: string;
  title: string;
  location?: string | null;
  persons: AttendancePerson[];
}

export interface AttendanceEventGroup {
  name: string;
  shifts: AttendanceShift[];
}

export interface AttendanceDay {
  date: string;
  event_groups: AttendanceEventGroup[];
}

export interface AttendanceExportOptions {
  organisation: string;
  event_title?: string | null;
  period_from?: string;
  period_to?: string;
  days: AttendanceDay[];
  /** UI / filename locale */
  locale?: "de" | "en";
}
