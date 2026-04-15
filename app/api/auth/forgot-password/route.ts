import { NextResponse } from "next/server";
import { checkRateLimit } from "../../../../lib/rateLimit";
import { asTrimmedString, isValidEmail, readJson } from "../../../../lib/validation";
import { getClientIp, getRequestId, log } from "../../../../lib/log";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { sendPasswordReset } from "../../../../lib/n8n";

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

    let baseUrl: string;
    try {
      const { getPublicBaseUrl } = await import("../../../../lib/publicBaseUrl");
      baseUrl = await getPublicBaseUrl();
    } catch {
      baseUrl = process.env.NEXT_PUBLIC_APP_URL || (req.headers.get("origin") ?? "");
    }
    const redirectTo = `${baseUrl.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent("/auth/reset-password?next=/login")}`;

    const service = createSupabaseServiceRoleClient();

    // Benutzer-Lookup – falls kein Account existiert, still beenden (kein User-Enumeration)
    const { data: userData } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = (userData?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === normalizedEmail);
    if (!existingUser) {
      // Kein Fehler loggen, kein Hinweis nach außen – anti-enumeration
      return NextResponse.json({ message: "If an account exists for this email, you'll receive a reset link shortly." });
    }

    const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: { redirectTo }
    });
    if (linkError) {
      log("warn", "forgot_password_error", { requestId, route: "auth/forgot-password", ip });
      return NextResponse.json({ message: "If an account exists for this email, you'll receive a reset link shortly." });
    }

    const resetLink = linkData?.properties?.action_link ?? (linkData as { action_link?: string } | null)?.action_link;

    if (resetLink && typeof resetLink === "string") {
      const fullName = (existingUser.user_metadata?.full_name as string | undefined) ?? undefined;
      await sendPasswordReset({ email: normalizedEmail, resetLink, fullName }).catch((err) =>
        log("error", "forgot_password_n8n_failed", { requestId, error: String(err) })
      );
    }

    return NextResponse.json({ message: "If an account exists for this email, you'll receive a reset link shortly." });
  } catch (e) {
    log("error", "forgot_password_unexpected", { requestId: getRequestId(req), route: "auth/forgot-password", error: String(e) });
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}
