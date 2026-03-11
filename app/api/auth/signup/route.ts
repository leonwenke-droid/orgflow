import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL_SEND_MAGIC_LINK ||
  "https://n8n.srv881499.hstgr.cloud/webhook/send-magic-link";

export async function POST(req: NextRequest) {
  try {
    const { email, password, firstName, lastName, claimToken } = await req.json();
    if (!email || !password) {
      return NextResponse.json(
        { message: "E-Mail und Passwort sind erforderlich." },
        { status: 400 }
      );
    }
    if (String(password).length < 6) {
      return NextResponse.json(
        { message: "Passwort mindestens 6 Zeichen." },
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

    let baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
    if (!baseUrl && req.url) try { baseUrl = new URL(req.url).origin; } catch { /* ignore */ }
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

    const subject = "E-Mail bestätigen – AbiOrga";
    const body =
      (fullName ? `Hallo ${fullName},\n\n` : "Hallo,\n\n") +
      "bitte bestätigen Sie Ihre E-Mail-Adresse, indem Sie auf den folgenden Link klicken:\n\n" +
      actionLink +
      "\n\nDanach werden Sie automatisch weitergeleitet.\n\nMit freundlichen Grüßen\nIhr AbiOrga-Team";

    const webhookRes = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(email).trim(),
        confirmLink: actionLink,
        fullName: fullName ?? undefined,
        type: "signup",
        subject,
        body
      })
    });

    if (!webhookRes.ok) {
      console.error("n8n webhook send-magic-link failed:", webhookRes.status, await webhookRes.text());
      return NextResponse.json(
        { message: "E-Mail konnte nicht versendet werden. Bitte später erneut versuchen." },
        { status: 502 }
      );
    }

    return NextResponse.json({ message: "ok" });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: "Unerwarteter Fehler." },
      { status: 500 }
    );
  }
}
