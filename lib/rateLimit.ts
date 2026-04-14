import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const WINDOW_MS = 60 * 1000;
const DEFAULT_MAX = 10;

const memoryStore = new Map<string, { count: number; resetAt: number }>();

let redisClient: Redis | null | undefined;
const upstashLimiters = new Map<number, Ratelimit>();
let warnedMissingUpstash = false;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redisClient = null;
    if (!warnedMissingUpstash) {
      warnedMissingUpstash = true;
      console.warn(
        "[rateLimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — using in-memory rate limiting (ineffective across serverless instances)."
      );
    }
    return null;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

function getUpstashLimiter(maxPerWindow: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const cached = upstashLimiters.get(maxPerWindow);
  if (cached) return cached;
  const lim = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxPerWindow, "60 s"),
    analytics: false,
    prefix: `@orgflow/rl/${maxPerWindow}`
  });
  upstashLimiters.set(maxPerWindow, lim);
  return lim;
}

function checkRateLimitMemory(
  identifier: string,
  maxPerWindow: number
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  let entry = memoryStore.get(identifier);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    memoryStore.set(identifier, entry);
    return { ok: true };
  }
  entry.count += 1;
  if (entry.count > maxPerWindow) {
    return { ok: false, retryAfterMs: Math.max(0, entry.resetAt - now) };
  }
  return { ok: true };
}

/**
 * Per-minute rate limit. Uses Upstash when `UPSTASH_REDIS_REST_URL` and
 * `UPSTASH_REDIS_REST_TOKEN` are set; otherwise falls back to in-memory (dev/single instance).
 */
export async function checkRateLimit(
  identifier: string,
  maxPerWindow: number = DEFAULT_MAX
): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  const limiter = getUpstashLimiter(maxPerWindow);
  if (limiter) {
    const result = await limiter.limit(identifier);
    if (!result.success) {
      return { ok: false, retryAfterMs: Math.max(0, result.reset - Date.now()) };
    }
    return { ok: true };
  }
  return checkRateLimitMemory(identifier, maxPerWindow);
}

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of memoryStore.entries()) {
      if (now >= val.resetAt) memoryStore.delete(key);
    }
  }, 5 * 60 * 1000);
}
