export type LogLevel = "debug" | "info" | "warn" | "error";

type Base = Record<string, unknown>;

export function log(level: LogLevel, message: string, meta?: Base) {
  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    ...(meta ?? {}),
  };
  // Vercel aggregates console output; JSON makes it queryable.
  if (level === "error") console.error(JSON.stringify(payload));
  else if (level === "warn") console.warn(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}

export function getRequestId(req: Request): string | null {
  return (
    req.headers.get("x-request-id") ??
    req.headers.get("x-vercel-id") ??
    req.headers.get("cf-ray") ??
    null
  );
}

export function getClientIp(req: Request): string {
  return (
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

