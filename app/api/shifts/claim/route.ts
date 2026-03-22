import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentOrganization, getOrgIdForData } from "../../../../lib/getOrganization";
import { writeAuditLog } from "../../../../lib/audit";
import { createUserNotification } from "../../../../lib/notifications";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Sign in required." }, { status: 401 });
    }

    const body = await req.json();
    const orgSlug = (body.orgSlug as string)?.trim();
    const shiftId = (body.shiftId as string)?.trim();
    const organizationIdBody = (body.organizationId as string)?.trim() || null;
    if (!orgSlug || !shiftId) {
      return NextResponse.json({ message: "orgSlug and shiftId required." }, { status: 400 });
    }

    const org = await getCurrentOrganization(orgSlug);
    const orgIdForData = getOrgIdForData(orgSlug, org.id);

    let { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("organization_id", orgIdForData)
      .maybeSingle();
    if (!profile && orgIdForData !== org.id) {
      const { data: p2 } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .eq("organization_id", org.id)
        .maybeSingle();
      profile = p2;
    }
    if (!profile) {
      return NextResponse.json({ message: "You are not a member of this organisation." }, { status: 403 });
    }

    // Capacity + insert is handled atomically inside RPC (security definer).
    const { error: rpcErr } = await supabase.rpc("claim_shift_slot", { shift_id: shiftId });
    if (rpcErr) {
      const msg = (rpcErr as { message?: string }).message ?? "";
      if (/already_assigned/i.test(msg) || (rpcErr as { code?: string }).code === "23505") {
        return NextResponse.json({ message: "You are already assigned." }, { status: 400 });
      }
      if (/no_free_slots/i.test(msg)) {
        return NextResponse.json({ message: "No free slots." }, { status: 400 });
      }
      if (/shift_not_found/i.test(msg)) {
        return NextResponse.json({ message: "Shift not found." }, { status: 404 });
      }
      if (/not_member/i.test(msg)) {
        return NextResponse.json({ message: "You are not a member of this organisation." }, { status: 403 });
      }
      return NextResponse.json({ message: "Failed to sign up." }, { status: 500 });
    }

    await writeAuditLog({
      organizationId: orgIdForData,
      actorProfileId: (profile as { id: string }).id,
      action: "shift_claimed",
      targetTable: "shifts",
      targetId: shiftId,
      metadata: {}
    });

    const notifOrgId = organizationIdBody || orgIdForData;
    const svc = createSupabaseServiceRoleClient();
    await createUserNotification(svc, {
      profileId: (profile as { id: string }).id,
      organizationId: notifOrgId,
      type: "shift_self_claimed",
      title: "Schicht übernommen",
      body: "Du hast dich für eine Schicht eingetragen.",
      link: `/${orgSlug}/shifts`
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[shifts/claim]", e);
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}
