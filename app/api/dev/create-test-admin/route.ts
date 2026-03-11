import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

const EMAIL = "leon@abi-orga.test";
const PASSWORD = "LeonTestPasswort123!";

export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_SEED_SECRET;
  const urlSecret = req.nextUrl.searchParams.get("secret");

  if (!secret || !urlSecret || urlSecret !== secret) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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
      await supabase.from("profiles").upsert(
        { id: found.id, full_name: "Leon", role: "admin" },
        { onConflict: "id" }
      );
      return NextResponse.json({
        message: "Test-Admin existierte bereits – Passwort und Rolle aktualisiert.",
        email: EMAIL,
        password: PASSWORD
      });
    }

    const { data: created, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true
    });

    if (error || !created.user) {
      return NextResponse.json(
        { message: "Fehler beim Anlegen.", detail: error?.message },
        { status: 500 }
      );
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: created.user.id,
      full_name: "Leon",
      role: "admin"
    });

    if (profileError) {
      return NextResponse.json(
        { message: "User angelegt, Profil fehlgeschlagen.", detail: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Test-Admin (Leon, Jahrgangssprecher) erfolgreich angelegt.",
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
