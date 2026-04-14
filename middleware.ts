import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

// Lokal (localhost): NEXT_PUBLIC_ROOT_HOST weglassen – dann nur Pfad-URLs wie /my-org/dashboard
const ROOT_HOST = process.env.NEXT_PUBLIC_ROOT_HOST; // z. B. "orgflow.app" (nur Produktion/Subdomain)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const RESERVED_ORG_SLUGS = new Set([
  "api",
  "admin",
  "auth",
  "login",
  "signup",
  "dashboard",
  "tasks",
  "shifts",
  "events",
  "materials",
  "engagement",
  "finance",
  "treasury",
  "settings",
  "onboarding",
  "super-admin",
  "me",
  "account",
  "feedback",
  "_next",
]);

const ORG_SCOPED_SEGMENTS = new Set([
  "dashboard",
  "overview",
  "tasks",
  "shifts",
  "me",
  "account",
  "feedback",
  "admin",
  "settings",
  "onboarding",
]);

function hardenAuthCookiesOnResponse(res: NextResponse, opts: { secure: boolean }) {
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  try {
    const all = res.cookies.getAll();
    for (const c of all) {
      if (!c.name.startsWith("sb-")) continue;
      if (!c.name.includes("-auth-token")) continue;
      res.cookies.set({
        name: c.name,
        value: c.value,
        path: "/",
        sameSite: "lax",
        secure: opts.secure,
        httpOnly: true,
        maxAge,
      });
    }
  } catch {
    // ignore
  }
}

const PUBLIC_PREFIXES = [
  "/login",
  "/task",
  "/invite",
  "/privacy",
  "/terms",
  "/imprint",
  "/_next",
  "/create-organisation",
  "/join"
];

/** Root routes that are real App Router pages, not `/{org}/…` (matcher `/:org` also matches `/login`, `/super-admin`, …). */
function isGlobalRootAppRoute(pathname: string): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname === "/super-admin" || pathname.startsWith("/super-admin/")) return true;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return true;
  if (pathname === "/signup" || pathname.startsWith("/signup/")) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

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

function loginRedirect(req: NextRequest, pathname: string) {
  const redirectUrl = req.nextUrl.clone();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && (segments[1] === "admin" || segments[1] === "settings" || segments[1] === "onboarding")) {
    redirectUrl.pathname = `/${segments[0]}/login`;
  } else {
    redirectUrl.pathname = "/login";
  }
  redirectUrl.searchParams.set("redirectTo", pathname + req.nextUrl.search);
  return NextResponse.redirect(redirectUrl);
}

async function runMiddleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const host = req.headers.get("host") ?? "";
  const res = NextResponse.next();

  const isLocalhost =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]") ||
    host.includes("localhost:");
  const shouldUseSecureCookies = process.env.NODE_ENV === "production" && !isLocalhost;

  // Real API routes are handled by route handlers. Do not treat `/api/*` as org pages.
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return res;
  }

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

  // ----- Reserved / unknown org slugs: avoid route collisions and phantom org shells -----
  const isGlobalAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  if (!isGlobalAdminPath && !isGlobalRootAppRoute(pathname)) {
    const segments = pathname.split("/").filter(Boolean);
    const orgSlug = segments[0] ?? null;
    const maybeOrgScoped = !!orgSlug && (segments.length === 1 || ORG_SCOPED_SEGMENTS.has(segments[1] ?? ""));
    if (orgSlug && maybeOrgScoped) {
      if (RESERVED_ORG_SLUGS.has(orgSlug)) {
        return NextResponse.rewrite(new URL("/404", req.url));
      }
    }
  }

  // ----- Geschützte Routen: Login erforderlich -----
  if (requiresAuth(pathname)) {
    if (!String(SUPABASE_URL ?? "").trim() || !String(SUPABASE_ANON_KEY ?? "").trim()) {
      console.error(
        "[middleware] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in the Edge bundle. In Vercel, assign both for Production (and Preview if needed) and redeploy so they are embedded at build time."
      );
      return new NextResponse("Service temporarily unavailable.", { status: 503 });
    }

    let supabase: ReturnType<typeof createMiddlewareClient>;
    try {
      supabase = createMiddlewareClient({ req, res });
    } catch (clientErr) {
      console.error("[middleware] createMiddlewareClient failed", clientErr);
      return loginRedirect(req, pathname);
    }

    let session: Session | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      session = data.session;
    } catch (sessionErr) {
      console.error("[middleware] getSession failed", sessionErr);
      session = null;
    }

    if (!session) {
      return loginRedirect(req, pathname);
    }
  }

  try {
    hardenAuthCookiesOnResponse(res, { secure: shouldUseSecureCookies });
  } catch (hardenErr) {
    console.error("[middleware] hardenAuthCookiesOnResponse failed", hardenErr);
  }
  return res;
}

export async function middleware(req: NextRequest) {
  try {
    return await runMiddleware(req);
  } catch (e) {
    console.error(
      "[middleware fatal]",
      e instanceof Error ? e.message : e,
      e instanceof Error ? e.stack : ""
    );
    // Never rethrow: Vercel surfaces uncaught middleware errors as MIDDLEWARE_INVOCATION_FAILED.
    if (requiresAuth(req.nextUrl.pathname)) {
      try {
        return loginRedirect(req, req.nextUrl.pathname);
      } catch {
        return NextResponse.next();
      }
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/",
    "/admin",
    "/admin/:path*",
    "/dashboard",
    "/super-admin",
    "/super-admin/:path*",
    "/:org/dashboard",
    "/:org/admin",
    "/:org/admin/:path*",
    "/:org/settings",
    "/:org/settings/:path*",
    "/:org/onboarding",
    "/:org/onboarding/:path*",
    "/:org/login",
    "/:org",
  ]
};
