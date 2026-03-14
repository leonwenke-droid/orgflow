import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { getCurrentOrganization, getOrgIdForData } from "../../../../lib/getOrganization";

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
    const service = createSupabaseServiceRoleClient();

    const { data: profile } = await service
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("organization_id", orgIdForData)
      .single();
    if (!profile) {
      return NextResponse.json({ message: "You are not a member of this organisation." }, { status: 403 });
    }

    const { data: shift } = await service
      .from("shifts")
      .select("id, organization_id, required_slots")
      .eq("id", shiftId)
      .eq("organization_id", orgIdForData)
      .single();
    if (!shift) {
      return NextResponse.json({ message: "Shift not found." }, { status: 404 });
    }

    const { count } = await service
      .from("shift_assignments")
      .select("id", { count: "exact", head: true })
      .eq("shift_id", shiftId);
    const required = Number(shift.required_slots ?? 0) || 1;
    if ((count ?? 0) >= required) {
      return NextResponse.json({ message: "No free slots." }, { status: 400 });
    }

    const { error: insertErr } = await service.from("shift_assignments").insert({
      shift_id: shiftId,
      user_id: profile.id,
      status: "zugewiesen",
    });
    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json({ message: "You are already assigned." }, { status: 400 });
      }
      return NextResponse.json({ message: insertErr.message || "Failed to sign up." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[shifts/claim]", e);
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}
