import type { ShiftForPdf } from "../shiftForPdf";
import { formatCheckIn, formatDateLong, formatExportedAt, formatPeriodRange, formatTimeShort } from "./format";
import { attendanceTranslations, type AttendancePdfLocale } from "./translations";
import type {
  AttendanceAssignmentRow,
  AttendanceDayGroup,
  AttendanceReport,
  AttendanceShiftSection
} from "./types";

function eventGroupKey(eventName: string): string {
  return String(eventName ?? "")
    .trim()
    .replace(/\s*–\s*[12]\.\s*Pause$/i, "")
    .replace(/\s*–\s*\d{1,2}:\d{2}–\d{1,2}:\d{2}$/, "")
    .trim() || "—";
}

function mapAssignment(
  a: NonNullable<ShiftForPdf["shift_assignments"]>[number],
  profileNames: Record<string, string>,
  locale: AttendancePdfLocale
): AttendanceAssignmentRow {
  const name = profileNames[a.user_id ?? ""] ?? "?";
  const status = a.status ?? "zugewiesen";
  const rep =
    status === "abgesagt" && a.replacement_user_id
      ? profileNames[a.replacement_user_id] ?? null
      : null;

  const hasCheckIn = !!(a.checked_in_at || status === "erledigt");

  let statusKind: AttendanceAssignmentRow["statusKind"] = "pending";
  if (hasCheckIn) statusKind = "present";
  else if (status === "abgesagt") statusKind = "cancelled";
  else statusKind = "pending";

  const checkInDisplay = hasCheckIn
    ? formatCheckIn(a.checked_in_at, a.check_in_method ?? null, locale) ?? (locale === "de" ? "bestätigt" : "confirmed")
    : null;

  return {
    name,
    role: null,
    statusKind,
    replacementName: rep,
    checkInDisplay
  };
}

export function mapShiftsToAttendanceReport(
  shifts: ShiftForPdf[],
  profileNames: Record<string, string>,
  organisation: string,
  organisationSlug: string | null,
  periodFrom: string,
  periodTo: string,
  locale: AttendancePdfLocale,
  documentEventTitle?: string | null
): AttendanceReport {
  const t = attendanceTranslations[locale];
  const byDate = new Map<string, ShiftForPdf[]>();
  for (const s of shifts) {
    const d = String(s.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (d < periodFrom.slice(0, 10) || d > periodTo.slice(0, 10)) continue;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(s);
  }

  const days: AttendanceDayGroup[] = [];
  const sortedDates = [...byDate.keys()].sort();

  for (const dateStr of sortedDates) {
    const dayShifts = byDate.get(dateStr)!;
    const eventGroups = new Map<string, ShiftForPdf[]>();
    for (const s of dayShifts) {
      const key = eventGroupKey(s.event_name);
      if (!eventGroups.has(key)) eventGroups.set(key, []);
      eventGroups.get(key)!.push(s);
    }
    for (const [, group] of eventGroups) {
      group.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
    }

    for (const [eventTitle, groupShifts] of eventGroups) {
      const first = groupShifts[0];
      const location = first?.location?.trim() || null;
      const shiftsOut: AttendanceShiftSection[] = [];

      for (const s of groupShifts) {
        const assignments = s.shift_assignments ?? [];
        const required = Math.max(1, Number(s.required_slots ?? 1) || 1);
        const filled = assignments.length;
        const slotsLabel = t.slotsFilled.replace("{filled}", String(filled)).replace("{total}", String(required));

        const rows: AttendanceAssignmentRow[] = assignments.map((a) => mapAssignment(a, profileNames, locale));

        const openSlots = Math.max(0, required - filled);
        for (let i = 0; i < openSlots; i++) {
          rows.push({
            name: t.openSlot,
            role: null,
            statusKind: "open",
            checkInDisplay: null
          });
        }

        shiftsOut.push({
          id: s.id,
          title: s.event_name || eventTitle,
          date: dateStr,
          startTime: formatTimeShort(s.start_time),
          endTime: formatTimeShort(s.end_time),
          location: s.location?.trim() || null,
          requiredSlots: required,
          filledCount: filled,
          slotsLabel,
          rows
        });
      }

      days.push({
        date: dateStr,
        dateHeadline: formatDateLong(dateStr, locale),
        eventTitle,
        location,
        shifts: shiftsOut
      });
    }
  }

  return {
    organisation,
    organisationSlug,
    documentEventTitle: documentEventTitle?.trim() || null,
    periodFrom: periodFrom.slice(0, 10),
    periodTo: periodTo.slice(0, 10),
    periodDisplay: formatPeriodRange(periodFrom, periodTo, locale),
    exportedAtDisplay: formatExportedAt(locale),
    days
  };
}
