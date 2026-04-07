import type { ShiftForPdf } from "../components/ShiftAttendancePdfExport";

export type AssignmentWithCheckin = NonNullable<ShiftForPdf["shift_assignments"]>[number] & {
  checked_in_at?: string | null;
};

export type MemberAttendanceRow = {
  userId: string;
  name: string;
  shiftCount: number;
  presentCount: number;
  ratePercent: number;
};

export function addCalendarDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Rolling window [from, to] inclusive by calendar date string. */
export function lastNDaysRange(todayYmd: string, n: number): { from: string; to: string } {
  return { from: addCalendarDays(todayYmd, -(n - 1)), to: todayYmd };
}

export function computeShiftConsoleStats(
  shifts: ShiftForPdf[],
  profileNames: Map<string, string>,
  todayYmd: string,
  windowDays = 30
): {
  ratePercent: number | null;
  completedShiftsCount: number;
  unexcusedMissedCount: number;
  memberRows: MemberAttendanceRow[];
} {
  const { from, to } = lastNDaysRange(todayYmd, windowDays);

  const inWindow = shifts.filter((s) => {
    const d = String(s.date ?? "").slice(0, 10);
    return d >= from && d <= to;
  });

  let totalAssignments = 0;
  let checkedIn = 0;
  let unexcusedMissed = 0;

  const perUser = new Map<string, { shiftCount: number; presentCount: number }>();

  for (const s of inWindow) {
    const d = String(s.date ?? "").slice(0, 10);
    const isPast = d < todayYmd;
    const assigns = (s.shift_assignments ?? []) as AssignmentWithCheckin[];

    for (const a of assigns) {
      if (!a.user_id) continue;
      totalAssignments += 1;
      if (a.checked_in_at) checkedIn += 1;

      if (isPast && !a.checked_in_at && a.status !== "erledigt" && a.status !== "abgesagt") {
        unexcusedMissed += 1;
      }

      if (!perUser.has(a.user_id)) perUser.set(a.user_id, { shiftCount: 0, presentCount: 0 });
      const row = perUser.get(a.user_id)!;
      row.shiftCount += 1;
      if (a.checked_in_at || a.status === "erledigt") row.presentCount += 1;
    }
  }

  const ratePercent =
    totalAssignments > 0 ? Math.round((checkedIn / totalAssignments) * 100) : null;

  const completedShiftsCount = inWindow.filter((s) => String(s.date ?? "").slice(0, 10) < todayYmd).length;

  const memberRows: MemberAttendanceRow[] = [...perUser.entries()]
    .map(([userId, c]) => {
      const rate = c.shiftCount > 0 ? Math.round((c.presentCount / c.shiftCount) * 100) : 0;
      return {
        userId,
        name: profileNames.get(userId) ?? "?",
        shiftCount: c.shiftCount,
        presentCount: c.presentCount,
        ratePercent: rate
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    ratePercent,
    completedShiftsCount,
    unexcusedMissedCount: unexcusedMissed,
    memberRows
  };
}

export function memberRowsToCsv(rows: MemberAttendanceRow[], locale: "de" | "en"): string {
  const sep = ";";
  const hName = locale === "de" ? "Name" : "Name";
  const hShifts = locale === "de" ? "Schichten" : "Shifts";
  const hPresent = locale === "de" ? "Anwesend" : "Present";
  const hRate = locale === "de" ? "Rate" : "Rate";
  const lines = [[hName, hShifts, hPresent, hRate].join(sep)];
  for (const r of rows) {
    lines.push([r.name, String(r.shiftCount), String(r.presentCount), `${r.ratePercent}%`].join(sep));
  }
  return lines.join("\n") + "\n";
}
