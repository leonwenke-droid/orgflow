import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { checkRateLimit } from "../../../../lib/rateLimit";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { getSingleOrgDashboardPathForUserId } from "../../../../lib/getOrganization";
import { getClientIp, getRequestId, log } from "../../../../lib/log";

export const runtime = "nodejs";

const LOGIN_RATE_LIMIT = 10; // per minute per IP

function hardenAuthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>, opts: { secure: boolean }) {
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  for (const c of cookieStore.getAll()) {
    if (!c.name.startsWith("sb-")) continue;
    if (!c.name.includes("-auth-token")) continue;
    cookieStore.set({
      name: c.name,
      value: c.value,
      path: "/",
      sameSite: "lax",
      secure: opts.secure,
      httpOnly: true,
      maxAge,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const requestId = getRequestId(req);
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: "Email and password are required." },
        { status: 400 }
      );
    }

    const email = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");
    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required." },
        { status: 400 }
      );
    }

    const limit = await checkRateLimit(`login:${ip}:${email.toLowerCase()}`, LOGIN_RATE_LIMIT);
    if (!limit.ok) {
      log("warn", "rate_limit", { requestId, route: "auth/login", ip, key: "login" });
      return NextResponse.json(
        { message: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } }
      );
    }

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    // Clear any stale session first to prevent cross-org account-switch race conditions.
    await supabase.auth.signOut();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    const host = req.headers.get("host") ?? "";
    const isLocalhost =
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("[::1]") ||
      host.includes("localhost:");
    const shouldUseSecureCookies = process.env.NODE_ENV === "production" && !isLocalhost;

    if (error) {
      log("warn", "auth_login_failed", { requestId, route: "auth/login", ip, email: email.toLowerCase() });
      const needsVerification =
        /email not confirmed|confirm your email|bestätig/i.test(error.message ?? "") ||
        (error as { status?: string }).status === "email_not_confirmed";
      if (needsVerification) {
        return NextResponse.json(
          {
            message: "Email not confirmed. Please check your inbox and click the confirmation link.",
            needsVerification: true
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        {
          message: "Login failed. Please check your credentials."
        },
        { status: 400 }
      );
    }

    const service = createSupabaseServiceRoleClient();
    const { data: profile } = await service
      .from("profiles")
      .select("id, status, organization_id, role")
      .eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id ?? null)
      .maybeSingle();

    if (profile?.status === "disabled") {
      await supabase.auth.signOut();
      log("warn", "auth_login_disabled", { requestId, route: "auth/login", ip });
      return NextResponse.json(
        {
          message: "This account has been disabled. Please contact an administrator.",
          errorKey: "members.status_disabled"
        },
        { status: 403 }
      );
    }

    // Cookies werden vom Auth-Helper gesetzt
    hardenAuthCookies(cookieStore, { secure: shouldUseSecureCookies });

    const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
    const defaultOrgDashboard = uid ? await getSingleOrgDashboardPathForUserId(uid) : null;

    return NextResponse.json({
      message: "ok",
      ...(defaultOrgDashboard ? { defaultOrgDashboard } : {})
    });
  } catch (e) {
    log("error", "auth_login_unexpected", { requestId: getRequestId(req), route: "auth/login", error: String(e) });
    return NextResponse.json(
      { message: "Unexpected login error." },
      { status: 500 }
    );
  }
}

