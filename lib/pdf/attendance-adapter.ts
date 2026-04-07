import type { ShiftForPdf } from "../shiftForPdf";
import { formatOrgRoleForPdf } from "./orgRoleLabels";
import type {
  AttendanceDay,
  AttendanceEventGroup,
  AttendanceExportOptions,
  AttendancePerson,
  AttendanceShift,
  AttendanceStatus
} from "./attendance-types";

function eventGroupKey(eventName: string): string {
  return String(eventName ?? "")
    .trim()
    .replace(/\s*–\s*[12]\.\s*Pause$/i, "")
    .replace(/\s*–\s*\d{1,2}:\d{2}–\d{1,2}:\d{2}$/, "")
    .trim() || "—";
}

function timeHM(t: string | null | undefined): string {
  const s = String(t ?? "").trim();
  return s.slice(0, 5) || "??:??";
}

type AssignmentRow = NonNullable<ShiftForPdf["shift_assignments"]>[number];

function mapAssignmentStatus(a: AssignmentRow): AttendanceStatus {
  const att = a.attendance_status != null ? String(a.attendance_status).toLowerCase() : "";
  if (att === "present") return "present";
  if (att === "absent") return "absent";
  if (att === "excused") return "excused";

  const status = a.status ?? "zugewiesen";
  const hasCheckIn = !!(a.checked_in_at || status === "erledigt");
  if (hasCheckIn) return "present";
  if (status === "abgesagt") return "cancelled";
  return "pending";
}

function checkinDisplay(a: AssignmentRow, locale: "de" | "en"): string | null {
  const hasCheckIn = !!(a.checked_in_at || a.status === "erledigt");
  if (!hasCheckIn) return null;
  if (!a.checked_in_at) return locale === "de" ? "bestätigt" : "confirmed";
  const d = new Date(a.checked_in_at);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(locale === "de" ? "de-DE" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * Maps OrgFlow `ShiftForPdf[]` + profile names to `AttendanceExportOptions` for jsPDF export.
 */
export function buildAttendanceExportData(params: {
  organisationName: string;
  shifts: ShiftForPdf[];
  profileNames: Record<string, string>;
  /** `profiles.role` per user (organisation membership: member, admin, lead, …) */
  profileRoles?: Record<string, string | null | undefined>;
  eventTitle?: string | null;
  periodFrom?: string;
  periodTo?: string;
  locale?: "de" | "en";
}): AttendanceExportOptions {
  const {
    organisationName,
    shifts,
    profileNames,
    profileRoles,
    eventTitle,
    periodFrom,
    periodTo,
    locale = "en"
  } = params;
  const loc = locale === "de" ? "de" : "en";

  const byDate = new Map<string, ShiftForPdf[]>();
  for (const s of shifts) {
    const d = String(s.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(s);
  }

  const sortedDates = [...byDate.keys()].sort();

  const days: AttendanceDay[] = sortedDates.map((date) => {
    const dayShifts = byDate.get(date)!;
    const eventGroups = new Map<string, ShiftForPdf[]>();
    for (const s of dayShifts) {
      const key = eventGroupKey(s.event_name);
      if (!eventGroups.has(key)) eventGroups.set(key, []);
      eventGroups.get(key)!.push(s);
    }
    for (const [, group] of eventGroups) {
      group.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
    }

    const event_groups: AttendanceEventGroup[] = [];

    for (const [groupName, groupShifts] of eventGroups) {
      const pdfShifts: AttendanceShift[] = groupShifts.map((sh) => {
        const assignments = sh.shift_assignments ?? [];
        const required = Math.max(1, Number(sh.required_slots ?? 1) || 1);

        const assignedPersons: AttendancePerson[] = assignments.map((a) => {
          const uid = a.user_id ?? "";
          const name = profileNames[uid] ?? "?";
          const rawRole = profileRoles?.[uid];
          const roleLabel = formatOrgRoleForPdf(rawRole ?? null, loc);
          return {
            name,
            role: roleLabel,
            status: mapAssignmentStatus(a),
            checkin_time: checkinDisplay(a, loc)
          };
        });

        const openSlots = Math.max(0, required - assignedPersons.length);
        const openPersons: AttendancePerson[] = Array.from({ length: openSlots }, () => ({
          name: "",
          status: "open" as const
        }));

        return {
          time_from: timeHM(sh.start_time),
          time_to: timeHM(sh.end_time),
          title: sh.event_name || groupName,
          location: sh.location?.trim() || undefined,
          persons: [...assignedPersons, ...openPersons]
        };
      });

      event_groups.push({ name: groupName, shifts: pdfShifts });
    }

    return { date, event_groups };
  });

  return {
    organisation: organisationName,
    event_title: eventTitle?.trim() || null,
    period_from: periodFrom ?? sortedDates[0],
    period_to: periodTo ?? sortedDates[sortedDates.length - 1],
    days,
    locale: loc
  };
}
