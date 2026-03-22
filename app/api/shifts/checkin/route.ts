import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import {
  getCurrentOrganization,
  getOrgIdForData,
  isOrgAdmin
} from "../../../../lib/getOrganization";
import { pickProfileForShiftClaim } from "../../../../lib/claimShiftForMember";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

function allowedShiftOrg(shiftOrgId: string, orgId: string, orgSlug: string) {
  const orgIdForData = getOrgIdForData(orgSlug, orgId);
  const allowed = new Set([orgId, orgIdForData]);
  return allowed.has(shiftOrgId);
}

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
    const orgSlug = String(body.orgSlug ?? "").trim();
    let assignmentId = String(body.assignmentId ?? "").trim();
    const shiftIdRaw = String(body.shiftId ?? "").trim();

    if (!orgSlug) {
      return NextResponse.json({ message: "orgSlug required." }, { status: 400 });
    }
    if (!assignmentId && !shiftIdRaw) {
      return NextResponse.json(
        { message: "assignmentId or shiftId required." },
        { status: 400 }
      );
    }

    const org = await getCurrentOrganization(orgSlug);
    const orgIdForData = getOrgIdForData(orgSlug, org.id);
    const allowedOrgIds = [...new Set([org.id, orgIdForData])];

    const service = createSupabaseServiceRoleClient();
    const admin = await isOrgAdmin(orgIdForData);

    /** Resolve assignment from shiftId when member has exactly one assignment on that shift */
    if (!assignmentId && shiftIdRaw) {
      const { data: shift, error: shiftErr } = await service
        .from("shifts")
        .select("id, organization_id")
        .eq("id", shiftIdRaw)
        .maybeSingle();

      if (shiftErr || !shift) {
        return NextResponse.json({ message: "Shift not found." }, { status: 404 });
      }
      const shiftOrgId = shift.organization_id as string;
      if (!allowedShiftOrg(shiftOrgId, org.id, orgSlug)) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      const { data: profiles, error: profErr } = await service
        .from("profiles")
        .select("id, organization_id, role, status")
        .eq("auth_user_id", user.id)
        .in("organization_id", allowedOrgIds);

      if (profErr || !profiles?.length) {
        return NextResponse.json({ message: "Profile not found." }, { status: 404 });
      }

      const profile = pickProfileForShiftClaim(
        profiles as {
          id: string;
          organization_id: string;
          role: string | null;
          status: string | null;
        }[],
        shiftOrgId,
        allowedOrgIds
      );

      if (!profile || (profile.role ?? "") === "viewer") {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      const { data: rows, error: listErr } = await service
        .from("shift_assignments")
        .select("id, checked_in_at")
        .eq("shift_id", shiftIdRaw)
        .eq("user_id", profile.id);

      if (listErr) {
        return NextResponse.json({ message: listErr.message }, { status: 400 });
      }
      const list = rows ?? [];
      if (list.length === 0) {
        return NextResponse.json(
          { message: "No assignment for you on this shift." },
          { status: 404 }
        );
      }
      if (list.length > 1) {
        return NextResponse.json(
          {
            message:
              "Several assignments found for you on this shift. Use the personal check-in link from the admin."
          },
          { status: 409 }
        );
      }
      assignmentId = list[0].id as string;
    }

    const { data: row, error: loadErr } = await service
      .from("shift_assignments")
      .select("id, user_id, checked_in_at, shifts!inner(organization_id)")
      .eq("id", assignmentId)
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json({ message: loadErr.message }, { status: 400 });
    }
    if (!row) {
      return NextResponse.json({ message: "Assignment not found." }, { status: 404 });
    }

    const shiftOrgId = (row as { shifts?: { organization_id?: string } }).shifts
      ?.organization_id as string;
    if (!shiftOrgId || !allowedShiftOrg(shiftOrgId, org.id, orgSlug)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    let mayCheckIn = admin;
    if (!mayCheckIn) {
      const { data: assignee } = await service
        .from("profiles")
        .select("auth_user_id")
        .eq("id", row.user_id as string)
        .maybeSingle();
      mayCheckIn = !!(assignee && assignee.auth_user_id === user.id);
    }

    if (!mayCheckIn) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (row.checked_in_at) {
      return NextResponse.json({ ok: true, alreadyCheckedIn: true });
    }

    let checkedInBy: string | null = null;
    if (admin) {
      const { data: profiles } = await service
        .from("profiles")
        .select("id, organization_id, role, status")
        .eq("auth_user_id", user.id)
        .in("organization_id", allowedOrgIds);
      const checker = pickProfileForShiftClaim(
        (profiles ?? []) as {
          id: string;
          organization_id: string;
          role: string | null;
          status: string | null;
        }[],
        shiftOrgId,
        allowedOrgIds
      );
      checkedInBy = checker?.id ?? null;
    } else {
      checkedInBy = row.user_id as string;
    }

    const { error: updErr } = await service
      .from("shift_assignments")
      .update({
        checked_in_at: new Date().toISOString(),
        checked_in_by: checkedInBy
      })
      .eq("id", assignmentId);

    if (updErr) {
      return NextResponse.json({ message: updErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[shifts/checkin]", e);
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}
