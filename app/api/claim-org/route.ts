import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user }
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
    }

    const { token } = await req.json().catch(() => ({}));
    if (!token || typeof token !== "string") {
      return NextResponse.json({ message: "Token fehlt." }, { status: 400 });
    }

    const service = createSupabaseServiceRoleClient();
    const { data: org, error: orgErr } = await service
      .from("organizations")
      .select("id, slug")
      .eq("setup_token", token.trim())
      .is("setup_token_used_at", null)
      .eq("is_active", true)
      .single();

    if (orgErr || !org) {
      return NextResponse.json(
        { message: "Link ungültig oder bereits verwendet." },
        { status: 400 }
      );
    }

    const orgId = (org as { id: string }).id;
    const fullName =
      (user.user_metadata?.full_name as string)?.trim() ||
      [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(" ").trim() ||
      (user.email ? user.email.split("@")[0].replace(/[._]/g, " ") : null) ||
      "Admin";
    const email = (user.email ?? "").trim() || null;

    let profile = (await service
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single()).data;

    if (!profile) {
      const { randomUUID } = await import("crypto");
      const newId = randomUUID();
      const { error: insertErr } = await service.from("profiles").insert({
        id: newId,
        full_name: fullName,
        email,
        role: "admin",
        auth_user_id: user.id,
        organization_id: orgId
      });
      if (insertErr) {
        return NextResponse.json(
          { message: "Profil konnte nicht angelegt werden." },
          { status: 400 }
        );
      }
      profile = { id: newId };
    } else {
      const { error: updateErr } = await service.from("profiles").update({
        organization_id: orgId,
        role: "admin",
        full_name: fullName,
        email
      }).eq("id", (profile as { id: string }).id);
      if (updateErr) {
        return NextResponse.json(
          { message: "Profil konnte nicht auf Admin aktualisiert werden." },
          { status: 400 }
        );
      }
    }

    await service.from("organizations").update({
      setup_token_used_at: new Date().toISOString()
    }).eq("id", (org as { id: string }).id);

    return NextResponse.json({
      orgSlug: (org as { slug: string }).slug
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: "Übernahme fehlgeschlagen." },
      { status: 500 }
    );
  }
}
