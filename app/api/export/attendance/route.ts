import { NextRequest, NextResponse } from "next/server";
import { fetchActiveOrganizationBySlug, getOrgIdForData } from "../../../../lib/getOrganization";
import { requireOrgAdminAction } from "../../../../lib/permissionsServer";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { isMissingSoftDeleteColumnError } from "../../../../lib/supabaseSoftDelete";
import type { ShiftForPdf } from "../../../../lib/shiftForPdf";
import { mapShiftsToAttendanceReport } from "../../../../lib/attendancePdf/mapShiftsToReport";
import { buildAttendancePdfHtml, attendanceReportToPdfBuffer } from "../../../../lib/attendancePdf/renderAttendancePdf";
import type { AttendancePdfLocale } from "../../../../lib/attendancePdf/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const SHIFT_SELECT =
  "id, event_name, date, start_time, end_time, location, notes, has_aufbau, has_abbau, required_slots, auto_assign, claimable, assignment_kind, attendance_mode, event_id, qr_token, qr_valid_from, qr_valid_until, organization_id";

/**
 * GET /api/export/attendance?orgId=…&start=YYYY-MM-DD&end=YYYY-MM-DD&locale=de|en&orgSlug=…&eventTitle=…
 * Defaults: locale=en; start/end wide open if omitted (all shifts for org).
 * Optional eventTitle: shown in the PDF header “Event” line (otherwise "—").
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const orgIdParam = searchParams.get("orgId")?.trim() || null;
    const orgSlugParam = searchParams.get("orgSlug")?.trim() || null;
    const start = searchParams.get("start")?.trim() || "1970-01-01";
    const end = searchParams.get("end")?.trim() || "2099-12-31";
    const localeRaw = searchParams.get("locale")?.trim().toLowerCase() || "en";
    const locale: AttendancePdfLocale = localeRaw === "de" ? "de" : "en";
    const documentEventTitle = searchParams.get("eventTitle")?.trim() || null;

    let orgId = orgIdParam;
    let orgSlug = orgSlugParam;

    if (!orgId && orgSlug) {
      const org = await fetchActiveOrganizationBySlug(orgSlug);
      if (org) {
        orgId = getOrgIdForData(orgSlug, org.id);
      }
    }

    if (!orgId) {
      return NextResponse.json({ message: "orgId or orgSlug required" }, { status: 400 });
    }

    const actor = await requireOrgAdminAction(orgId, orgSlug);
    if (!actor) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const service = createSupabaseServiceRoleClient();

    const { data: orgRow } = await service.from("organizations").select("name, slug").eq("id", orgId).maybeSingle();
    const organisationName = (orgRow as { name?: string | null } | null)?.name?.trim() || "—";
    const slugFromDb = (orgRow as { slug?: string | null } | null)?.slug?.trim() || null;

    async function buildShiftsQuery(includeDeleted: boolean) {
      let q = service
        .from("shifts")
        .select(SHIFT_SELECT)
        .eq("organization_id", orgId!)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      if (includeDeleted) q = q.is("deleted_at", null);
      return q;
    }

    let shiftsRes = await buildShiftsQuery(true);
    if (shiftsRes.error && isMissingSoftDeleteColumnError(shiftsRes.error.message)) {
      shiftsRes = await buildShiftsQuery(false);
    }
    if (shiftsRes.error) {
      console.error(shiftsRes.error);
      return NextResponse.json({ message: shiftsRes.error.message }, { status: 500 });
    }

    const shiftsRaw = shiftsRes.data ?? [];
    const shiftIds = shiftsRaw.map((s: { id: string }) => s.id).filter(Boolean);

    const { data: assignmentsRaw } = await service
      .from("shift_assignments")
      .select("id, shift_id, status, user_id, replacement_user_id, checked_in_at, check_in_method")
      .in("shift_id", shiftIds.length ? shiftIds : ["00000000-0000-0000-0000-000000000000"]);

    const assignmentsByShift = new Map<
      string,
      NonNullable<ShiftForPdf["shift_assignments"]>
    >();
    for (const a of assignmentsRaw ?? []) {
      const sid = (a as { shift_id: string }).shift_id;
      if (!sid) continue;
      if (!assignmentsByShift.has(sid)) assignmentsByShift.set(sid, []);
      assignmentsByShift.get(sid)!.push({
        id: (a as { id: string }).id,
        status: (a as { status: string }).status ?? "zugewiesen",
        user_id: (a as { user_id: string }).user_id ?? "",
        replacement_user_id: (a as { replacement_user_id?: string }).replacement_user_id ?? null,
        checked_in_at: (a as { checked_in_at?: string | null }).checked_in_at ?? null,
        check_in_method: (a as { check_in_method?: string | null }).check_in_method ?? null
      });
    }

    const { data: profiles } = await service.from("profiles").select("id, full_name").eq("organization_id", orgId);

    const profileNames: Record<string, string> = Object.fromEntries(
      (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? "?"])
    );

    const shifts: ShiftForPdf[] = (shiftsRaw as Record<string, unknown>[]).map((s) => ({
      id: s.id as string,
      event_name: (s.event_name as string) ?? "",
      date: (s.date as string) ?? "",
      start_time: (s.start_time as string) ?? "",
      end_time: (s.end_time as string) ?? "",
      location: (s.location as string | null) ?? null,
      has_aufbau: !!(s.has_aufbau as boolean),
      has_abbau: !!(s.has_abbau as boolean),
      required_slots: s.required_slots as number | undefined,
      auto_assign: s.auto_assign as boolean | null | undefined,
      claimable: s.claimable as boolean | null | undefined,
      assignment_kind: s.assignment_kind as string | undefined,
      attendance_mode: s.attendance_mode as string | undefined,
      event_id: s.event_id as string | null | undefined,
      qr_token: s.qr_token as string | null | undefined,
      qr_valid_from: s.qr_valid_from as string | null | undefined,
      qr_valid_until: s.qr_valid_until as string | null | undefined,
      shift_assignments: assignmentsByShift.get((s.id as string) ?? "") ?? []
    }));

    const report = mapShiftsToAttendanceReport(
      shifts,
      profileNames,
      organisationName,
      slugFromDb ?? orgSlug ?? null,
      start.slice(0, 10),
      end.slice(0, 10),
      locale,
      documentEventTitle
    );

    const html = await buildAttendancePdfHtml(report, locale);
    const pdf = await attendanceReportToPdfBuffer(html, locale);

    const datePart = new Date().toISOString().slice(0, 10);
    const base = locale === "de" ? "OrgFlow-Anwesenheit" : "OrgFlow-Attendance";
    const slugPart = (slugFromDb ?? orgSlug ?? "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 48);
    const filename = `${base}${slugPart ? `-${slugPart}` : ""}-${datePart}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "PDF export failed" },
      { status: 500 }
    );
  }
}
