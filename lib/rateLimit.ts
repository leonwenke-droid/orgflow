/**
 * Simple in-memory rate limiter. Use for development/single-instance.
 * For production with multiple instances, use Redis/Upstash or similar.
 */

const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX = 10;

export function checkRateLimit(
  identifier: string,
  maxPerWindow: number = DEFAULT_MAX
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  let entry = store.get(identifier);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(identifier, entry);
    return { ok: true };
  }
  entry.count += 1;
  if (entry.count > maxPerWindow) {
    return { ok: false, retryAfterMs: Math.max(0, entry.resetAt - now) };
  }
  return { ok: true };
}

/** Clear old entries periodically to avoid unbounded growth. */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of store.entries()) {
      if (now >= val.resetAt) store.delete(key);
    }
  }, 5 * 60 * 1000);
}
