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
export function addCalendarDaysYmd(ymd: string, delta: number): string | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + delta));
  return `${String(dt.getUTCFullYear()).padStart(4, "0")}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
}

/** Calendar date (YYYY-MM-DD) for `d` in Europe/Berlin. */
export function formatDateYmdInBerlin(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

const zdtfBerlin = new Intl.DateTimeFormat("en-CA", {
  timeZone: BERLIN,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

function berlinWallParts(ms: number): { y: number; m: number; d: number; H: number; M: number; S: number } {
  const parts = zdtfBerlin.formatToParts(new Date(ms));
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    H: get("hour"),
    M: get("minute"),
    S: get("second")
  };
}

/**
 * UTC epoch ms for `dateYmd` + `timeHm` interpreted in Europe/Berlin (wall clock).
 * Returns null if the local time does not exist (spring DST gap) or is invalid.
 */
export function berlinLocalDateTimeToUtcMs(dateYmd: string, timeHm: string): number | null {
  const p = parseYmd(dateYmd);
  if (!p) return null;
  const tm = String(timeHm ?? "").trim();
  const mm = tm.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!mm) return null;
  const H = Number(mm[1]);
  const M = Number(mm[2]);
  const S = mm[3] != null ? Number(mm[3]) : 0;
  if (H > 23 || M > 59 || S > 59 || H < 0 || M < 0 || S < 0) return null;

  const dayStart = startOfBerlinDayUtcMs(dateYmd);
  const nextYmd = addCalendarDaysYmd(dateYmd, 1);
  if (dayStart == null || nextYmd == null) return null;
  const nextStart = startOfBerlinDayUtcMs(nextYmd);
  if (nextStart == null) return null;

  let lo = dayStart;
  let hi = nextStart - 1;

  const cmpTargetVsWall = (utcMs: number): number => {
    const w = berlinWallParts(utcMs);
    const t = [p.y, p.m, p.d, H, M, S];
    const b = [w.y, w.m, w.d, w.H, w.M, w.S];
    for (let i = 0; i < 6; i++) {
      if (t[i] !== b[i]) return t[i] - b[i];
    }
    return 0;
  };

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const c = cmpTargetVsWall(mid);
    if (c === 0) return mid;
    if (c > 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
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
