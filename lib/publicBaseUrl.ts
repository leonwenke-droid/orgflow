import { headers } from "next/headers";

/**
 * Sync origin for emails/cron when there is no Request (no headers).
 * Prefer NEXT_PUBLIC_APP_URL in production.
 */
export function getPublicOriginSync(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const rootHost = (process.env.NEXT_PUBLIC_ROOT_HOST || "").trim().replace(/\/$/, "");
  if (rootHost) return `https://${rootHost}`;
  const vercel = (process.env.VERCEL_URL || "").trim().replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;
  return "https://www.orgflow.de";
}

function originFromHostHeader(host: string, protoHeader: string | null): string {
  const h = host.trim();
  const isLocal =
    h.startsWith("localhost") || h.startsWith("127.0.0.1") || h === "[::1]" || h.includes(".localhost");
  const proto = (protoHeader || "").trim() || (isLocal ? "http" : "https");
  return `${proto}://${h}`;
}

/**
 * Public base URL for building absolute links (invites, join links, redirects).
 *
 * Priority:
 * 1. NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_SITE_URL (canonical — set e.g. https://www.orgflow.de on Vercel)
 * 2. Incoming request Host (same domain the browser uses — before VERCEL_URL so links are not *.vercel.app)
 * 3. NEXT_PUBLIC_ROOT_HOST
 * 4. VERCEL_URL
 *
 * For emails, QR posters, and stable links, set NEXT_PUBLIC_APP_URL in production.
 */
export async function getPublicBaseUrl(): Promise<string> {
  const fromEnv = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  try {
    const h = await headers();
    const host = (h.get("x-forwarded-host") || h.get("host") || "").trim();
    if (host) {
      return originFromHostHeader(host, h.get("x-forwarded-proto"));
    }
  } catch {
    /* No request context (e.g. cron / script) — fall through to VERCEL_URL / error. */
  }

  const rootHost = (process.env.NEXT_PUBLIC_ROOT_HOST || "").trim().replace(/\/$/, "");
  if (rootHost) return `https://${rootHost}`;

  const vercel = (process.env.VERCEL_URL || "").trim().replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;

  throw new Error(
    "Public base URL missing. Set NEXT_PUBLIC_APP_URL (e.g. https://www.orgflow.de) or NEXT_PUBLIC_ROOT_HOST."
  );
}
