/** Shared shift time tab keys (used by server pages and client `ShiftTabFilter`). */
export type ShiftTimeFilter = "all" | "today" | "upcoming" | "past";

export function filterShiftsByTime<T extends { date?: string | null }>(
  shifts: T[],
  filter: ShiftTimeFilter,
  todayStr: string
): T[] {
  if (filter === "all") return shifts;
  if (filter === "today") return shifts.filter((s) => s.date === todayStr);
  if (filter === "upcoming") return shifts.filter((s) => (s.date ?? "") > todayStr);
  if (filter === "past") return shifts.filter((s) => (s.date ?? "") < todayStr);
  return shifts;
}
