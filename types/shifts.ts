/**
 * Shared shift / attendance types (see orgflow-schicht-attendance-cursor.md).
 * DB uses `assignment_kind` (e.g. auto_assign) and `attendance_mode` admin_only — not assignment_type/manual.
 */

export type AssignmentKind = "self_signup" | "auto_assign" | "rotation" | "fixed";

export type AttendanceMode = "qr" | "admin_only" | "none";

export type AttendanceStatus = "registered" | "present" | "absent" | "excused";

export type CheckInMethod = "qr" | "manual";

export interface Shift {
  id: string;
  organization_id: string;
  title: string;
  event_name?: string | null;
  location?: string | null;
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  required_slots?: number | null;
  assignment_kind: AssignmentKind;
  attendance_mode: AttendanceMode;
  qr_token?: string | null;
  qr_valid_from?: string | null;
  qr_valid_until?: string | null;
  event_id?: string | null;
  created_at?: string;
}

export interface ShiftAssignment {
  id: string;
  shift_id: string;
  user_id: string;
  organization_id?: string;
  status: string;
  attendance_status: AttendanceStatus;
  checked_in_at?: string | null;
  check_in_method?: CheckInMethod | null;
  checked_in_by?: string | null;
  profile?: { id: string; name: string; email?: string };
}

export interface ShiftWithAssignments extends Shift {
  assignments: ShiftAssignment[];
  assignments_count: number;
}
