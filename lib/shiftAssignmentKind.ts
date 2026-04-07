/** Matches DB `shifts.assignment_kind` / `shifts.attendance_mode`. */
export type ShiftAssignmentKind = "self_signup" | "auto_assign" | "rotation" | "fixed";
export type ShiftAttendanceMode = "qr" | "admin_only" | "none";

export function flagsFromAssignmentKind(kind: ShiftAssignmentKind): {
  claimable: boolean;
  auto_assign: boolean;
} {
  switch (kind) {
    case "self_signup":
      return { claimable: true, auto_assign: false };
    case "auto_assign":
      return { claimable: false, auto_assign: true };
    default:
      return { claimable: false, auto_assign: false };
  }
}

export function parseAssignmentKind(raw: string | null | undefined): ShiftAssignmentKind {
  const k = String(raw ?? "").trim();
  if (k === "auto_assign" || k === "rotation" || k === "fixed" || k === "self_signup") return k;
  return "self_signup";
}

export function parseAttendanceMode(raw: string | null | undefined): ShiftAttendanceMode {
  const m = String(raw ?? "").trim();
  if (m === "admin_only" || m === "none" || m === "qr") return m;
  return "qr";
}

/** Resolve kind when column missing (pre-migration clients). */
export function effectiveAssignmentKind(shift: {
  assignment_kind?: string | null;
  claimable?: boolean | null;
  auto_assign?: boolean | null;
}): ShiftAssignmentKind {
  const k = shift.assignment_kind;
  if (k === "self_signup" || k === "auto_assign" || k === "rotation" || k === "fixed") return k;
  if (shift.auto_assign === true) return "auto_assign";
  if (shift.claimable === false) return "fixed";
  return "self_signup";
}

export function memberMaySelfCheckIn(attendanceMode: string | null | undefined): boolean {
  return (attendanceMode ?? "qr") === "qr";
}
