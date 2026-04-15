/** YYYY-MM-DD helpers for rotation unavailability planner (UTC calendar dates). */

export function parseYmdUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return new Date(NaN);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatYmdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Merge sorted unique calendar days into contiguous [from, until] ranges (inclusive). */
export function mergeYmdToRanges(ymds: string[]): { from: string; until: string }[] {
  const uniq = [...new Set(ymds.filter(Boolean))].sort();
  if (uniq.length === 0) return [];
  const out: { from: string; until: string }[] = [];
  let start = uniq[0];
  let prev = uniq[0];
  for (let i = 1; i < uniq.length; i++) {
    const cur = uniq[i];
    const diff = (parseYmdUtc(cur).getTime() - parseYmdUtc(prev).getTime()) / 86400000;
    if (diff === 1) {
      prev = cur;
      continue;
    }
    out.push({ from: start, until: prev });
    start = cur;
    prev = cur;
  }
  out.push({ from: start, until: prev });
  return out;
}

export function expandDailyInclusive(fromYmd: string, untilYmd: string): string[] {
  const out: string[] = [];
  let d = parseYmdUtc(fromYmd);
  const end = parseYmdUtc(untilYmd);
  if (Number.isNaN(d.getTime()) || Number.isNaN(end.getTime()) || end.getTime() < d.getTime()) return out;
  while (d.getTime() <= end.getTime()) {
    out.push(formatYmdUtc(d));
    d = new Date(d.getTime() + 86400000);
  }
  return out;
}

/**
 * @param weekdaysIso — 1 = Monday … 7 = Sunday (ISO weekday)
 */
export function expandWeeklyInclusive(
  fromYmd: string,
  untilYmd: string,
  weekdaysIso: number[]
): string[] {
  const want = new Set(weekdaysIso.filter((n) => n >= 1 && n <= 7));
  if (want.size === 0) return [];
  const out: string[] = [];
  let d = parseYmdUtc(fromYmd);
  const end = parseYmdUtc(untilYmd);
  if (Number.isNaN(d.getTime()) || Number.isNaN(end.getTime()) || end.getTime() < d.getTime()) return out;
  while (d.getTime() <= end.getTime()) {
    const dow = d.getUTCDay();
    const iso = dow === 0 ? 7 : dow;
    if (want.has(iso)) out.push(formatYmdUtc(d));
    d = new Date(d.getTime() + 86400000);
  }
  return out;
}
