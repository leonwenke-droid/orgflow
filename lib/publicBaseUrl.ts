import { headers } from "next/headers";

/**
 * Public base URL for building absolute links (invites, join links).
 *
 * Priority:
 * - NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_SITE_URL (full URL)
 * - NEXT_PUBLIC_ROOT_HOST (host only -> https://{host})
 * - VERCEL_URL (host -> https://{host})
 * - request Host header (as last resort, assumes https in production)
 *
 * Never falls back to localhost to avoid leaking dev URLs.
 */
export async function getPublicBaseUrl(): Promise<string> {
  const fromEnv = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const rootHost = (process.env.NEXT_PUBLIC_ROOT_HOST || "").trim().replace(/\/$/, "");
  if (rootHost) return `https://${rootHost}`;

  const vercel = (process.env.VERCEL_URL || "").trim().replace(/\/$/, "");
  if (vercel) {
    if (vercel.includes(".vercel.app")) return "https://orgflow.de";
    return `https://${vercel}`;
  }

  const h = await headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "").trim();
  if (host) {
    const proto = (h.get("x-forwarded-proto") || "https").trim();
    return `${proto}://${host}`;
  }

  throw new Error("Public base URL missing. Set NEXT_PUBLIC_APP_URL (recommended) or NEXT_PUBLIC_ROOT_HOST.");
}

