import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { checkRateLimit } from "../../../../lib/rateLimit";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

const LOGIN_RATE_LIMIT = 10; // per minute per IP

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
    const limit = checkRateLimit(`login:${ip}`, LOGIN_RATE_LIMIT);
    if (!limit.ok) {
      return NextResponse.json(
        { message: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } }
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: "E-Mail und Passwort sind erforderlich." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      const needsVerification =
        /email not confirmed|confirm your email|bestätig/i.test(error.message ?? "") ||
        (error as { status?: string }).status === "email_not_confirmed";
      if (needsVerification) {
        return NextResponse.json(
          {
            message: "E-Mail noch nicht bestätigt. Bitte Postfach prüfen und Link in der E-Mail klicken.",
            needsVerification: true
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        {
          message: "Login fehlgeschlagen. Bitte Zugangsdaten prüfen.",
          detail: error.message
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
      return NextResponse.json(
        {
          message: "This account has been disabled. Please contact an administrator.",
          errorKey: "members.status_disabled"
        },
        { status: 403 }
      );
    }

    // Cookies werden vom Auth-Helper gesetzt
    return NextResponse.json({ message: "ok" });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: "Unerwarteter Fehler beim Login." },
      { status: 500 }
    );
  }
}

