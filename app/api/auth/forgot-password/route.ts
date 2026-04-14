import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { checkRateLimit } from "../../../../lib/rateLimit";
import { asTrimmedString, isValidEmail, readJson } from "../../../../lib/validation";
import { getClientIp, getRequestId, log } from "../../../../lib/log";

export async function POST(req: Request) {
  try {
    const parsed = await readJson<{ email?: unknown }>(req);
    const email = parsed.ok ? asTrimmedString(parsed.data.email) : "";
    const normalizedEmail = email.toLowerCase();

    const ip = getClientIp(req);
    const requestId = getRequestId(req);
    const limit = await checkRateLimit(`forgot-password:${ip}:${normalizedEmail || "unknown"}`, 5);
    if (!limit.ok) {
      log("warn", "rate_limit", { requestId, route: "auth/forgot-password", ip, key: "forgot-password" });
      return NextResponse.json({ message: "Too many reset requests. Please try again later." }, {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) }
      });
    }

    // Avoid user enumeration: always return 200 for syntactically invalid/missing emails.
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return NextResponse.json({ message: "If an account exists for this email, you'll receive a reset link shortly." });
    }

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    let baseUrl: string;
    try {
      const { getPublicBaseUrl } = await import("../../../../lib/publicBaseUrl");
      baseUrl = await getPublicBaseUrl();
    } catch {
      baseUrl = process.env.NEXT_PUBLIC_APP_URL || (req.headers.get("origin") ?? "");
    }
    const redirectTo = `${baseUrl.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent("/auth/reset-password?next=/login")}`;

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    if (error) {
      log("warn", "forgot_password_error", { requestId, route: "auth/forgot-password", ip });
      return NextResponse.json({ message: "If an account exists for this email, you'll receive a reset link shortly." });
    }

    return NextResponse.json({ message: "If an account exists for this email, you'll receive a reset link shortly." });
  } catch (e) {
    log("error", "forgot_password_unexpected", { requestId: getRequestId(req), route: "auth/forgot-password", error: String(e) });
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}
