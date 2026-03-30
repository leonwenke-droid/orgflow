import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

// Lokal (localhost): NEXT_PUBLIC_ROOT_HOST weglassen – dann nur Pfad-URLs wie /my-org/dashboard
const ROOT_HOST = process.env.NEXT_PUBLIC_ROOT_HOST; // z. B. "orgflow.app" (nur Produktion/Subdomain)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const PUBLIC_PREFIXES = [
  "/login",
  "/task",
  "/invite",
  "/privacy",
  "/terms",
  "/imprint",
  "/api",
  "/_next",
  "/create-organisation",
  "/join"
];

// Geschützte Bereiche: Admin/Settings/Onboarding/Dashboard erfordern Login.
function requiresAuth(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/")))
    return false;
  if (pathname.startsWith("/admin")) return true;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return true;
  if (pathname.startsWith("/super-admin")) return true;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && segments[1] === "admin") return true;
  if (segments.length >= 2 && segments[1] === "settings") return true;
  if (segments.length >= 2 && segments[1] === "onboarding") return true;
  if (segments.length >= 2 && segments[1] === "dashboard") return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const host = req.headers.get("host") ?? "";
  const res = NextResponse.next();

  // ----- Subdomain → Hauptdomain mit Slug-Redirect (nur wenn ROOT_HOST gesetzt; auf localhost weglassen) -----
  if (ROOT_HOST && SUPABASE_URL && SUPABASE_ANON_KEY && host.endsWith(ROOT_HOST) && host !== ROOT_HOST) {
    const subdomain = host.slice(0, -ROOT_HOST.length).replace(/\.$/, "");
    if (subdomain) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data: org } = await supabase
          .from("organizations")
          .select("slug")
          .eq("subdomain", subdomain)
          .eq("is_active", true)
          .single();

        if (org?.slug) {
          const base = `https://${ROOT_HOST}`;
          const path = pathname === "/" ? `/${org.slug}/dashboard` : `/${org.slug}${pathname}`;
          return NextResponse.redirect(new URL(path, base));
        }
      } catch (_) {
        // bei Fehler normal weiter
      }
    }
  }

  // ----- Geschützte Routen: Login erforderlich -----
  if (requiresAuth(pathname)) {
    const supabase = createMiddlewareClient({ req, res });
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      const redirectUrl = req.nextUrl.clone();
      const segments = pathname.split("/").filter(Boolean);
      const orgSlug = segments[0] ?? "";
      const orgArea = segments[1] ?? "";
      // Org-Bereiche: zu [org]/login weiterleiten (nicht globales /login — dort ist redirectTo eingeschränkt)
      if (
        segments.length >= 2 &&
        (segments[1] === "admin" ||
          segments[1] === "settings" ||
          segments[1] === "onboarding" ||
          segments[1] === "dashboard")
      ) {
        redirectUrl.pathname = `/${orgSlug}/login`;
      } else {
        redirectUrl.pathname = "/login";
      }
      redirectUrl.searchParams.set("redirectTo", pathname + req.nextUrl.search);
      const resp = NextResponse.redirect(redirectUrl);
      // Debug headers (safe, no secrets): helps diagnose prod redirect loops.
      resp.headers.set("x-orgflow-mw", "auth-redirect");
      resp.headers.set("x-orgflow-path", pathname);
      resp.headers.set("x-orgflow-host", host);
      resp.headers.set("x-orgflow-org", orgSlug || "-");
      resp.headers.set("x-orgflow-area", orgArea || "-");
      resp.headers.set("x-orgflow-login", redirectUrl.pathname);
      // #region agent log
      fetch("http://127.0.0.1:7660/ingest/d8a4d5cc-1252-4b30-be66-acb41eda1386", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "fa0047" },
        body: JSON.stringify({
          sessionId: "fa0047",
          runId: "pre-fix-prod",
          hypothesisId: "H3",
          location: "middleware.ts:auth-redirect",
          message: "no session; redirecting",
          data: {
            pathname,
            host,
            orgSlug: orgSlug || null,
            orgArea: orgArea || null,
            loginPath: redirectUrl.pathname,
          },
          timestamp: Date.now()
        })
      }).catch(() => {});
      // #endregion
      return resp;
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/", // für Subdomain-Redirect (z. B. my-org.orgflow.app/ → /my-org/dashboard)
    "/admin",
    "/admin/:path*",
    "/dashboard",
    "/super-admin", // exakt, damit Middleware läuft und zu /login?redirectTo=/super-admin weiterleitet
    "/super-admin/:path*",
    "/:org/dashboard",
    "/:org/admin",
    "/:org/admin/:path*",
    "/:org/settings",
    "/:org/settings/:path*",
    "/:org/onboarding",
    "/:org/onboarding/:path*",
    "/:org/login", // Org-Login erreichbar halten
    "/:org", // ein Segment, z. B. /my-org
  ]
};
