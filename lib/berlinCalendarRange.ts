/**
 * Map YYYY-MM-DD calendar ranges to UTC instants so overlap checks match
 * `rotation_shift_window` (Europe/Berlin) and shift RPCs.
 *
 * A day off "2026-04-20" must block the full local day in Berlin, not
 * 12:00–23:59 UTC (which misses early-morning shifts on that date in DE).
 */

const BERLIN = "Europe/Berlin";

function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const t = String(s ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, d] = t.split("-").map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** Smallest UTC ms such that `ymd` is the calendar date in Europe/Berlin at local 00:00–00:00. */
function startOfBerlinDayUtcMs(ymd: string): number | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  const { y, m, d } = p;
  const want = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const key = (ms: number): string => {
    const parts = dtf.formatToParts(new Date(ms));
    const yy = parts.find((x) => x.type === "year")?.value ?? "";
    const mm = parts.find((x) => x.type === "month")?.value ?? "";
    const dd = parts.find((x) => x.type === "day")?.value ?? "";
    return `${yy}-${mm}-${dd}`;
  };
  let lo = Date.UTC(y, m - 1, d - 2, 12, 0, 0);
  let hi = Date.UTC(y, m - 1, d + 2, 12, 0, 0);
  if (key(lo) > want || key(hi) < want) return null;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (key(mid) < want) lo = mid + 1;
    else hi = mid;
  }
  if (key(lo) !== want) return null;
  let start = lo;
  const minBound = Date.UTC(y, m - 1, d - 2, 0, 0, 0);
  while (start > minBound && key(start - 1) === want) start--;
  return start;
}

/** Next civil YYYY-MM-DD after `ymd` (for exclusive end of inclusive range). */
function addCalendarDaysYmd(ymd: string, delta: number): string | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + delta));
  return `${String(dt.getUTCFullYear()).padStart(4, "0")}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
}

/**
 * Full-day absences in Berlin: [start of `fromYmd` 00:00, start of day after `untilYmd`) in UTC.
 * Overlap test in SQL remains: u.unavailable_from < v_w_end AND u.unavailable_until > v_w_start
 */
export function memberUnavailabilityRangeToIso(
  fromYmd: string,
  untilYmd: string
): { unavailable_from: string; unavailable_until: string } | null {
  const a = fromYmd.trim();
  const b = untilYmd.trim();
  const fromStart = startOfBerlinDayUtcMs(a);
  const dayAfterUntil = addCalendarDaysYmd(b, 1);
  if (fromStart == null || dayAfterUntil == null) return null;
  const untilExclusive = startOfBerlinDayUtcMs(dayAfterUntil);
  if (untilExclusive == null) return null;
  if (untilExclusive <= fromStart) return null;
  return {
    unavailable_from: new Date(fromStart).toISOString(),
    unavailable_until: new Date(untilExclusive).toISOString()
  };
}
