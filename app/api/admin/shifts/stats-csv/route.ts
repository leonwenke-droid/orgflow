import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin } from "../../../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../../../lib/supabaseServer";
import type { ShiftForPdf } from "../../../../../components/ShiftAttendancePdfExport";
import { computeShiftConsoleStats, memberRowsToCsv } from "../../../../../lib/shiftStats";
import { getRequestLocale } from "../../../../../lib/localeServer";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const orgSlug = req.nextUrl.searchParams.get("org")?.trim() || "";
  if (!orgSlug) {
    return NextResponse.json({ message: "org required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let orgIdForData: string;
  try {
    const org = await getCurrentOrganization(orgSlug);
    orgIdForData = getOrgIdForData(orgSlug, org.id);
  } catch {
    return NextResponse.json({ message: "Org not found" }, { status: 404 });
  }

  if (!(await isOrgAdmin(orgIdForData, orgSlug))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const service = createSupabaseServiceRoleClient();
  const SHIFT_SELECT =
    "id, event_name, date, start_time, end_time, location, notes, has_aufbau, has_abbau, required_slots, auto_assign, claimable, assignment_kind, attendance_mode, event_id";

  const { data: shiftsRaw } = await service
    .from("shifts")
    .select(SHIFT_SELECT)
    .eq("organization_id", orgIdForData)
    .is("deleted_at", null)
    .order("date", { ascending: true });

  const { data: assignmentsRaw } = await service
    .from("shift_assignments")
    .select("id, shift_id, status, user_id, replacement_user_id, checked_in_at");

  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name")
    .eq("organization_id", orgIdForData);

  const profileNames = new Map((profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));

  const assignmentsByShift = new Map<string, NonNullable<ShiftForPdf["shift_assignments"]>>();
  for (const a of assignmentsRaw ?? []) {
    const sid = (a as { shift_id: string }).shift_id;
    if (!assignmentsByShift.has(sid)) assignmentsByShift.set(sid, []);
    assignmentsByShift.get(sid)!.push({
      id: (a as { id: string }).id,
      status: (a as { status: string }).status ?? "zugewiesen",
      user_id: (a as { user_id: string }).user_id ?? "",
      replacement_user_id: (a as { replacement_user_id?: string }).replacement_user_id ?? null,
      checked_in_at: (a as { checked_in_at?: string | null }).checked_in_at ?? null
    });
  }

  const shifts: ShiftForPdf[] = (shiftsRaw ?? []).map((s: Record<string, unknown>) => ({
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
    shift_assignments: assignmentsByShift.get((s.id as string) ?? "") ?? []
  }));

  const todayStr = new Date().toISOString().slice(0, 10);
  const { memberRows } = computeShiftConsoleStats(shifts, profileNames, todayStr, 30);
  const locale = await getRequestLocale();
  const csv = memberRowsToCsv(memberRows, locale === "en" ? "en" : "de");

  const filename = `shift-attendance-${orgSlug}-${todayStr}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
