import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin } from "../../../../lib/getOrganization";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const orgSlug = String(body.orgSlug ?? "").trim();
    const assignmentId = String(body.assignmentId ?? "").trim();
    if (!orgSlug || !assignmentId) {
      return NextResponse.json({ message: "orgSlug and assignmentId required." }, { status: 400 });
    }

    const org = await getCurrentOrganization(orgSlug);
    const orgIdForData = getOrgIdForData(orgSlug, org.id);
    if (!(await isOrgAdmin(orgIdForData))) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { data: checker } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const checkerId = (checker as any)?.id ?? null;
    if (!checkerId) return NextResponse.json({ message: "Profile not found." }, { status: 404 });

    const { error } = await supabase
      .from("shift_assignments")
      .update({ checked_in_at: new Date().toISOString(), checked_in_by: checkerId })
      .eq("id", assignmentId);
    if (error) return NextResponse.json({ message: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[shifts/checkin]", e);
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}

