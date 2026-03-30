export type JsonResult<T> = { ok: true; data: T } | { ok: false };

export async function readJson<T = unknown>(req: Request): Promise<JsonResult<T>> {
  try {
    const data = (await req.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

export function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function asInt(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export function isValidEmail(v: string): boolean {
  // deliberately simple; rely on Supabase for canonical validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

