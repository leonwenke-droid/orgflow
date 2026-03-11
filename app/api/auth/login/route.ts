import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: "E-Mail und Passwort sind erforderlich." },
        { status: 400 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });

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

