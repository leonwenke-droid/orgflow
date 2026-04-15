import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { checkRateLimit } from "../../../../lib/rateLimit";
import { sendSignupConfirmation } from "../../../../lib/n8n";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
    const rl = await checkRateLimit(`signup:${ip}`, 5);
    if (!rl.ok) {
      return NextResponse.json(
        { message: "Zu viele Anfragen. Bitte warte einen Moment." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const { email, password, firstName, lastName, claimToken } = await req.json();
    if (!email || !password) {
      return NextResponse.json(
        { message: "E-Mail und Passwort sind erforderlich." },
        { status: 400 }
      );
    }
    if (String(password).length < 8) {
      return NextResponse.json(
        { message: "Passwort mindestens 8 Zeichen." },
        { status: 400 }
      );
    }

    const fullName = [String(firstName || "").trim(), String(lastName || "").trim()]
      .filter(Boolean)
      .join(" ")
      .trim() || undefined;

    const service = createSupabaseServiceRoleClient();

    let organizationId: string | undefined;
    if (claimToken && typeof claimToken === "string" && claimToken.trim()) {
      const { data: org } = await service
        .from("organizations")
        .select("id")
        .eq("setup_token", claimToken.trim())
        .is("setup_token_used_at", null)
        .eq("is_active", true)
        .single();
      if (org && (org as { id?: string }).id) organizationId = (org as { id: string }).id;
    }

    const userMetadata: Record<string, string> = fullName ? { full_name: fullName } : {};
    if (organizationId) userMetadata.organization_id = organizationId;

    let baseUrl: string;
    try {
      const { getPublicBaseUrl } = await import("../../../../lib/publicBaseUrl");
      baseUrl = await getPublicBaseUrl();
    } catch {
      baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
    }
    const nextPath = claimToken
      ? `/claim-org?token=${encodeURIComponent(claimToken)}`
      : "/";
    const redirectTo = baseUrl ? `${baseUrl}/auth/callback?next=${encodeURIComponent(nextPath)}` : undefined;

    const { data: linkData, error } = await service.auth.admin.generateLink({
      type: "signup",
      email: String(email).trim(),
      password: String(password),
      options: {
        data: userMetadata,
        ...(redirectTo && { redirectTo })
      }
    });

    if (error) {
      return NextResponse.json(
        { message: error.message || "Registrierung fehlgeschlagen." },
        { status: 400 }
      );
    }

    const actionLink =
      linkData?.properties?.action_link ??
      (linkData as { action_link?: string })?.action_link;
    if (!actionLink || typeof actionLink !== "string") {
      return NextResponse.json(
        { message: "Verifizierungs-Link konnte nicht erzeugt werden." },
        { status: 500 }
      );
    }
    await sendSignupConfirmation({
      email: String(email).trim(),
      magicLink: actionLink,
      fullName: fullName ?? undefined
    });
    return NextResponse.json({ message: "ok" });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: "Unerwarteter Fehler." },
      { status: 500 }
    );
  }
}
