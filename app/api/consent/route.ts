import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Sign in required." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const consentType = String(body.consentType ?? "").trim();
    const consentValue = body.consentValue === undefined ? true : Boolean(body.consentValue);
    const metadata = (body.metadata && typeof body.metadata === "object") ? body.metadata : {};

    if (!consentType) {
      return NextResponse.json({ message: "consentType required." }, { status: 400 });
    }

    const { error } = await supabase.from("user_consents").insert({
      auth_user_id: user.id,
      consent_type: consentType,
      consent_value: consentValue,
      metadata
    });

    if (error) {
      return NextResponse.json({ message: error.message || "Failed to store consent." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[consent]", e);
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}

