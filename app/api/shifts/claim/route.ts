import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentOrganization, getOrgIdForData } from "../../../../lib/getOrganization";
import { writeAuditLog } from "../../../../lib/audit";
import { claimShiftForAuthenticatedMember } from "../../../../lib/claimShiftForMember";
import { createUserNotification } from "../../../../lib/notifications";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { notifyShiftAssignedByEmail } from "../../../../lib/shiftAssignmentNotifications";

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
    const allowed = new Set([org.id, orgIdForData]);
    const organizationIdFromForm =
      organizationIdBody && allowed.has(organizationIdBody) ? organizationIdBody : orgIdForData;

    const result = await claimShiftForAuthenticatedMember({
      authUserId: user.id,
      orgSlug,
      shiftId,
      organizationIdFromForm
    });

    if (!result.ok) {
      const code = result.code;
      if (code === "full") {
        return NextResponse.json({ message: "No free slots." }, { status: 400 });
      }
      if (code === "shift_not_found" || code === "wrong_org") {
        return NextResponse.json({ message: "Shift not found." }, { status: 404 });
      }
      if (code === "not_claimable") {
        return NextResponse.json({ message: "This shift cannot be self-assigned." }, { status: 400 });
      }
      if (code === "not_member" || code === "viewer") {
        return NextResponse.json({ message: "You are not a member of this organisation." }, { status: 403 });
      }
      if (code === "unavailable") {
        return NextResponse.json(
          { message: "You are marked unavailable for this shift time.", code: "unavailable" },
          { status: 400 }
        );
      }
      return NextResponse.json({ message: "Failed to sign up." }, { status: 500 });
    }

    await writeAuditLog({
      organizationId: result.organizationId,
      actorProfileId: result.profileId,
      action: "shift_claimed",
      targetTable: "shifts",
      targetId: shiftId,
      metadata: {}
    });

    const svc = createSupabaseServiceRoleClient();
    await createUserNotification(svc, {
      profileId: result.profileId,
      organizationId: result.organizationId,
      type: "shift_self_claimed",
      title: "Schicht übernommen",
      body: "Du hast dich für eine Schicht eingetragen.",
      link: `/${orgSlug}/shifts`
    });

    await notifyShiftAssignedByEmail({
      service: svc,
      profileId: result.profileId,
      shiftId,
      orgSlug
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[shifts/claim]", e);
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}
