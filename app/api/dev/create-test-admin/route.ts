import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

const EMAIL = "test2@orgflow.local";
const PASSWORD = "TestPassword123!";

export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_SEED_SECRET;
  const urlSecret = req.nextUrl.searchParams.get("secret");

  if (!secret || !urlSecret || urlSecret !== secret) {
    return NextResponse.json(
      { message: "Unauthorized. Set ADMIN_SEED_SECRET in Vercel and call ?secret=YOUR_SECRET" },
      { status: 401 }
    );
  }

  const supabase = createSupabaseServiceRoleClient();

  try {
    const { data: listData } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    const found = listData?.users?.find((u) => u.email === EMAIL);

    if (found) {
      await supabase.auth.admin.updateUserById(found.id, { password: PASSWORD });
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ full_name: "Test User", role: "admin" })
        .eq("auth_user_id", found.id);
      if (updateErr) {
        return NextResponse.json(
          { message: "Passwort aktualisiert, Profil-Update fehlgeschlagen.", detail: updateErr.message },
          { status: 500 }
        );
      }
      return NextResponse.json({
        message: "Test-User existierte bereits – Passwort und Rolle aktualisiert.",
        email: EMAIL,
        password: PASSWORD
      });
    }

    const { data: created, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Test User" }
    });

    if (error || !created.user) {
      return NextResponse.json(
        { message: "Fehler beim Anlegen.", detail: error?.message },
        { status: 500 }
      );
    }

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ full_name: "Test User", role: "admin" })
      .eq("auth_user_id", created.user.id);

    if (updateErr) {
      return NextResponse.json(
        { message: "User angelegt, Profil-Update fehlgeschlagen.", detail: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Test-User erfolgreich angelegt.",
      email: EMAIL,
      password: PASSWORD
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: "Unerwarteter Fehler.", detail: String(e) },
      { status: 500 }
    );
  }
}
