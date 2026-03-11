import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

// Lokal (localhost): NEXT_PUBLIC_ROOT_HOST weglassen – dann nur Pfad-URLs wie /abi-2026-tgg/dashboard
const ROOT_HOST = process.env.NEXT_PUBLIC_ROOT_HOST; // z. B. "abiorga.app" (nur Produktion/Subdomain)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const PUBLIC_PREFIXES = ["/login", "/task", "/api", "/_next", "/create-organisation", "/join"];

// Login nur für Admin (Jahrgang) und Super-Admin. Dashboard (Jahrgang) ist ohne Login erreichbar.
function requiresAuth(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/")))
    return false;
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/super-admin")) return true;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && segments[1] === "admin") return true;
  if (segments.length >= 2 && segments[1] === "settings") return true;
  if (segments.length >= 2 && segments[1] === "onboarding") return true;
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
      // Org-Admin: zu [org]/login weiterleiten
      if (segments.length >= 2 && (segments[1] === "admin" || segments[1] === "settings" || segments[1] === "onboarding")) {
        redirectUrl.pathname = `/${segments[0]}/login`;
      } else {
        redirectUrl.pathname = "/login";
      }
      redirectUrl.searchParams.set("redirectTo", pathname + req.nextUrl.search);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/", // für Subdomain-Redirect (z. B. tgg-2026.abiorga.app/ → /abi-2026-tgg/dashboard)
    "/admin",
    "/admin/:path*",
    "/dashboard",
    "/super-admin", // exakt, damit Middleware läuft und zu /login?redirectTo=/super-admin weiterleitet
    "/super-admin/:path*",
    "/:org/dashboard",
    "/:org/admin",
    "/:org/admin/:path*",
    "/:org/login", // Org-Login erreichbar halten
    "/:org", // ein Segment, z. B. /abi-2026-tgg
  ]
};
