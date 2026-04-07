import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin } from "../../../../../../lib/getOrganization";
import { t } from "../../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../../lib/localeServer";
import { createSupabaseServiceRoleClient } from "../../../../../../lib/supabaseServer";
import AttendanceClient from "../../../../../../components/shifts/AttendanceClient";
import type { ShiftForPdf } from "../../../../../../components/ShiftAttendancePdfExport";

export const dynamic = "force-dynamic";

export default async function ShiftAttendancePage({
  params
}: {
  params: Promise<{ org: string; shiftId: string }> | { org: string; shiftId: string };
}) {
  const p =
    typeof (params as Promise<{ org: string; shiftId: string }>).then === "function"
      ? await (params as Promise<{ org: string; shiftId: string }>)
      : (params as { org: string; shiftId: string });
  const orgSlug = p.org;
  const shiftId = p.shiftId;

  const locale = await getRequestLocale();
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/admin/shifts/${encodeURIComponent(shiftId)}/attendance`);
  }

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const admin = await isOrgAdmin(orgIdForData, orgSlug);
  if (!admin) {
    redirect(`/${orgSlug}/dashboard`);
  }

  const service = createSupabaseServiceRoleClient();
  const { data: shiftRow, error: shErr } = await service
    .from("shifts")
    .select(
      "id, event_name, date, start_time, end_time, location, has_aufbau, has_abbau, required_slots, auto_assign, claimable, assignment_kind, attendance_mode, event_id, organization_id"
    )
    .eq("id", shiftId)
    .maybeSingle();

  if (shErr || !shiftRow) notFound();
  const shiftOrg = (shiftRow as { organization_id?: string }).organization_id;
  if (shiftOrg !== org.id && shiftOrg !== orgIdForData) {
    notFound();
  }

  const { data: assignmentsRaw } = await service
    .from("shift_assignments")
    .select("id, shift_id, status, user_id, replacement_user_id, checked_in_at, check_in_method, attendance_status")
    .eq("shift_id", shiftId)
    .order("created_at", { ascending: true });

  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name")
    .in("organization_id", [...new Set([org.id, orgIdForData])]);

  const profileNames: Record<string, string> = Object.fromEntries(
    (profiles ?? []).map((x: { id: string; full_name: string }) => [x.id, x.full_name])
  );
  const shift: ShiftForPdf = {
    id: (shiftRow as { id: string }).id,
    event_name: (shiftRow as { event_name?: string }).event_name ?? "",
    date: (shiftRow as { date?: string }).date ?? "",
    start_time: (shiftRow as { start_time?: string }).start_time ?? "",
    end_time: (shiftRow as { end_time?: string }).end_time ?? "",
    location: (shiftRow as { location?: string | null }).location ?? null,
    has_aufbau: !!(shiftRow as { has_aufbau?: boolean }).has_aufbau,
    has_abbau: !!(shiftRow as { has_abbau?: boolean }).has_abbau,
    required_slots: (shiftRow as { required_slots?: number }).required_slots,
    auto_assign: (shiftRow as { auto_assign?: boolean | null }).auto_assign,
    claimable: (shiftRow as { claimable?: boolean | null }).claimable,
    assignment_kind: (shiftRow as { assignment_kind?: string }).assignment_kind,
    attendance_mode: (shiftRow as { attendance_mode?: string }).attendance_mode,
    event_id: (shiftRow as { event_id?: string | null }).event_id,
    shift_assignments: (assignmentsRaw ?? []) as ShiftForPdf["shift_assignments"]
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">{shift.event_name || t("dashboard.shifts", locale)}</h1>
          <p className="page-sub text-text-muted">
            {shift.date} · {String(shift.start_time ?? "").slice(0, 5)}–{String(shift.end_time ?? "").slice(0, 5)}
          </p>
        </div>
        <Link className="btn-secondary text-sm" href={`/admin/shifts?org=${encodeURIComponent(orgSlug)}&tab=attend`}>
          {t("shifts.attendance.back_console", locale)}
        </Link>
      </div>
      <AttendanceClient assignments={shift.shift_assignments ?? []} orgSlug={orgSlug} profileNames={profileNames} />
    </div>
  );
}
