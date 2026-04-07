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

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token?.trim()) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const service = createSupabaseServiceRoleClient();
    const { data, error } = await service
      .from("shifts")
      .select("id, event_name, date, start_time, end_time, qr_valid_from, qr_valid_until")
      .eq("qr_token", token.trim())
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ valid: false });
    }

    const now = new Date();
    const from = data.qr_valid_from ? new Date(data.qr_valid_from as string) : null;
    const until = data.qr_valid_until ? new Date(data.qr_valid_until as string) : null;
    const valid = !!(from && until && from <= now && until >= now);

    return NextResponse.json({
      valid,
      shift: valid ? data : null
    });
  } catch (e) {
    console.error("[shifts/checkin GET]", e);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

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
    const qrToken = String(body.qr_token ?? "").trim();

    if (!orgSlug) {
      return NextResponse.json({ message: "orgSlug required." }, { status: 400 });
    }

    const service = createSupabaseServiceRoleClient();

    /** Shift-level QR token → atomic RPC (spec). */
    if (qrToken) {
      const org = await getCurrentOrganization(orgSlug);
      const orgIdForData = getOrgIdForData(orgSlug, org.id);
      const allowedOrgIds = [...new Set([org.id, orgIdForData])];

      const { data: shiftForToken } = await service
        .from("shifts")
        .select("organization_id")
        .eq("qr_token", qrToken)
        .maybeSingle();

      if (!shiftForToken?.organization_id) {
        return NextResponse.json({ message: "invalid_or_expired_token" }, { status: 400 });
      }
      const shiftOrgId = shiftForToken.organization_id as string;
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

      const { data: rpcData, error: rpcErr } = await supabase.rpc("check_in_via_qr", {
        p_qr_token: qrToken,
        p_profile_id: profile.id
      });

      if (rpcErr) {
        return NextResponse.json({ message: rpcErr.message }, { status: 500 });
      }

      const payload = rpcData as { success?: boolean; error?: string } | null;
      if (!payload?.success) {
        const err = payload?.error ?? "checkin_failed";
        const status =
          err === "invalid_or_expired_token" || err === "not_registered" || err === "already_checked_in"
            ? 400
            : 400;
        return NextResponse.json({ message: err, error: err }, { status });
      }

      return NextResponse.json({
        ok: true,
        member_name: (rpcData as { member_name?: string }).member_name,
        shift_title: (rpcData as { shift_title?: string }).shift_title,
        checked_in_at: (rpcData as { checked_in_at?: string }).checked_in_at
      });
    }

    if (!assignmentId && !shiftIdRaw) {
      return NextResponse.json(
        { message: "assignmentId, shiftId, or qr_token required." },
        { status: 400 }
      );
    }

    const org = await getCurrentOrganization(orgSlug);
    const orgIdForData = getOrgIdForData(orgSlug, org.id);
    const allowedOrgIds = [...new Set([org.id, orgIdForData])];

    const admin = await isOrgAdmin(orgIdForData, orgSlug);

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
      .select("id, user_id, checked_in_at, shifts!inner(organization_id, attendance_mode)")
      .eq("id", assignmentId)
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json({ message: loadErr.message }, { status: 400 });
    }
    if (!row) {
      return NextResponse.json({ message: "Assignment not found." }, { status: 404 });
    }

    const shiftJoin = (row as { shifts?: { organization_id?: string; attendance_mode?: string } })
      .shifts;
    const shiftOrgId = shiftJoin?.organization_id as string;
    const attendanceMode = String(shiftJoin?.attendance_mode ?? "qr");
    if (!shiftOrgId || !allowedShiftOrg(shiftOrgId, org.id, orgSlug)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (!admin && attendanceMode !== "qr") {
      return NextResponse.json(
        {
          message:
            attendanceMode === "none"
              ? "Attendance is not tracked for this shift."
              : "Check-in is admin-only for this shift."
        },
        { status: 403 }
      );
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
        status: "erledigt",
        checked_in_at: new Date().toISOString(),
        checked_in_by: checkedInBy,
        check_in_method: admin ? "manual" : "qr",
        attendance_status: "present"
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
