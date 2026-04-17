import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { sendSupportRequest } from "../../../../lib/n8n";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const reason = String(body.reason ?? "").trim().slice(0, 500);

  const service = createSupabaseServiceRoleClient();
  const { data: profiles, error: profErr } = await service
    .from("profiles")
    .select("id, organization_id, status")
    .eq("auth_user_id", user.id);

  if (profErr) return NextResponse.json({ message: profErr.message }, { status: 500 });
  if (!profiles?.length) return NextResponse.json({ message: "Profile not found." }, { status: 404 });

  const active = profiles.filter((p) => (p as { status?: string | null }).status !== "disabled");
  if (!active.length) {
    return NextResponse.json({ message: "Account disabled." }, { status: 403 });
  }

  const inserted: { id: string; organization_id: string; profile_id: string }[] = [];
  for (const p of active) {
    const row = p as { id: string; organization_id: string };
    const { data: ins, error } = await service
      .from("deletion_requests")
      .insert({
        organization_id: row.organization_id,
        profile_id: row.id,
        status: "pending",
        reason: reason || null
      })
      .select("id, organization_id, profile_id")
      .maybeSingle();

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    if (ins) inserted.push(ins as { id: string; organization_id: string; profile_id: string });
  }

  if (user.email) {
    const msg = [
      "Löschanfrage (OrgFlow)",
      `Konto: ${user.email}`,
      reason ? `Grund: ${reason}` : "",
      `Anfragen: ${JSON.stringify(inserted)}`
    ]
      .filter(Boolean)
      .join("\n");

    void sendSupportRequest({
      email: user.email,
      type: "delete",
      subject: "OrgFlow: Löschanfrage",
      message: msg
    }).catch((err) => console.error("[deletion-request] n8n failed:", err));
  }

  return NextResponse.json({ ok: true });
}
