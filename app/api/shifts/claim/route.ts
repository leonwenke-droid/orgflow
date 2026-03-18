import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentOrganization, getOrgIdForData } from "../../../../lib/getOrganization";
import { writeAuditLog } from "../../../../lib/audit";

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
    if (!orgSlug || !shiftId) {
      return NextResponse.json({ message: "orgSlug and shiftId required." }, { status: 400 });
    }

    const org = await getCurrentOrganization(orgSlug);
    const orgIdForData = getOrgIdForData(orgSlug, org.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("organization_id", orgIdForData)
      .single();
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

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[shifts/claim]", e);
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}
