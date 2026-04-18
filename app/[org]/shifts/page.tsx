import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getRequestLocale } from "../../../lib/localeServer";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { redirectViewerToOrgOverview } from "../../../lib/viewerRouteGuard";
import { t } from "../../../lib/i18n";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { claimShiftAction, claimShiftSwapAction, requestShiftTransferAction } from "./actions";
import MemberShiftsClient from "../../../components/shifts/MemberShiftsClient";

export const dynamic = "force-dynamic";

export default async function ShiftsViewerPage(props: {
  params: Promise<{ org: string }> | { org: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const params = typeof (props.params as Promise<{ org: string }>).then === "function"
    ? await (props.params as Promise<{ org: string }>)
    : (props.params as { org: string });
  const orgSlug = params.org;
  const sp =
    props.searchParams && typeof (props.searchParams as Promise<unknown>).then === "function"
      ? await (props.searchParams as Promise<Record<string, string | string[] | undefined>>)
      : ((props.searchParams as Record<string, string | string[] | undefined> | undefined) ?? {});
  const shiftsFreeOnly = sp.free === "1" || sp.free === "true";
  const claimRaw = Array.isArray(sp.claimShift) ? sp.claimShift[0] : sp.claimShift;
  const claimShiftNotice =
    claimRaw === "unavailable" || claimRaw === "error" ? claimRaw : undefined;

  const authSupabase = createServerComponentClient({ cookies });
  const service = createSupabaseServiceRoleClient();

  const [org, { data: { user } }, locale] = await Promise.all([
    getCurrentOrganization(orgSlug),
    authSupabase.auth.getUser(),
    getRequestLocale()
  ]);
  if (!user) redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/shifts`);

  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const { data: mePrimary } = await service
    .from("profiles")
    .select("id, role, full_name")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();

  // Legacy-Mapping: Profile können unter der kanonischen org.id liegen.
  const { data: meFallback } = (!mePrimary && orgIdForData !== org.id)
    ? await service
        .from("profiles")
        .select("id, role, full_name")
        .eq("auth_user_id", user.id)
        .eq("organization_id", org.id)
        .maybeSingle()
    : { data: null };

  const myProfile = (mePrimary ?? meFallback) as { id?: string; role?: string; full_name?: string } | null;
  const myProfileId = myProfile?.id ?? null;
  const myDisplayName = myProfile?.full_name ?? "";
  const myRole = myProfile?.role ?? null;
  redirectViewerToOrgOverview(orgSlug, myRole);

  if (!myProfileId) {
    return (
      <div className="mx-auto max-w-3xl p-6 space-y-4">
        <div className="rounded-xl border border-border-subtle bg-bg-primary p-6 shadow-sm dark:border-border-default bg-card">
          <h1 className="text-lg font-semibold text-text-primary dark:text-text-primary">{t("common.access_denied", locale)}</h1>
          <p className="mt-2 text-sm text-text-secondary dark:text-text-muted">{t("dashboard.use_invited_account", locale)}</p>
        </div>
      </div>
    );
  }

  const canClaim = myRole !== "viewer";
  const effectiveOrgIdForData = mePrimary ? orgIdForData : org.id;

  const { data: shifts } = await service
    .from("shifts")
    .select("id, event_name, date, start_time, end_time, location, required_slots, auto_assign, claimable, assignment_kind, attendance_mode, qr_token, qr_valid_from, qr_valid_until, shift_assignments(id, user_id, replacement_user_id, status, swap_offered)")
    .eq("organization_id", effectiveOrgIdForData)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  const myAssignmentIds = new Set(
    (shifts ?? [])
      .flatMap((s: any) => (s.shift_assignments ?? []).map((a: any) => a))
      .filter((a: any) => a && (a.user_id === myProfileId) && a.replacement_user_id == null)
      .map((a: any) => String(a.id))
      .filter(Boolean)
  );

  const { data: pendingTransfers } = myAssignmentIds.size
    ? await service
        .from("shift_transfer_requests")
        .select("assignment_id")
        .eq("from_user_id", myProfileId)
        .eq("status", "pending")
        .in("assignment_id", [...myAssignmentIds])
    : { data: [] as any[] };
  const pendingAssignmentIds = new Set((pendingTransfers ?? []).map((r: any) => String(r.assignment_id)));

  // Swap offers (approved hand-offs): any offered assignment not yet taken.
  const { data: offeredRows } = await service
    .from("shift_assignments")
    .select("id, user_id, shift_id, shifts(id, event_name, date, start_time, end_time, location, required_slots, auto_assign, claimable, assignment_kind, attendance_mode, qr_token, qr_valid_from, qr_valid_until)")
    .eq("swap_offered", true)
    .is("replacement_user_id", null)
    .neq("user_id", myProfileId);
  const offered = (offeredRows ?? []) as any[];
  const offeredOwnerIds = [...new Set(offered.map((r) => String(r.user_id ?? "")).filter(Boolean))];
  const { data: offeredOwners } = offeredOwnerIds.length
    ? await service.from("profiles").select("id, full_name").in("id", offeredOwnerIds)
    : { data: [] as any[] };
  const ownerNameById = new Map((offeredOwners ?? []).map((p: any) => [String(p.id), String(p.full_name ?? "")]));
  const swapOffers = offered
    .map((r) => ({
      assignmentId: String(r.id),
      originalOwnerId: String(r.user_id ?? ""),
      originalOwnerName: ownerNameById.get(String(r.user_id ?? "")) || "",
      shift: (r as any).shifts ?? null
    }))
    .filter((x) => x.shift && x.assignmentId);

  const isAssignedToMe = (s: any) =>
    (s.shift_assignments ?? []).some(
      (a: any) => a.user_id === myProfileId || a.replacement_user_id === myProfileId
    );

  const myShifts = (shifts ?? []).filter((s: any) => isAssignedToMe(s));
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingShiftsRaw = (shifts ?? []).filter((s: any) => {
    // If date is present, hide past shifts. If date is missing (event-type), keep them visible.
    return !s.date || String(s.date).slice(0, 10) >= todayStr;
  });

  const upcomingShiftsSorted = [...upcomingShiftsRaw].sort((a: any, b: any) => {
    const ma = isAssignedToMe(a) ? 0 : 1;
    const mb = isAssignedToMe(b) ? 0 : 1;
    if (ma !== mb) return ma - mb;
    const da = String(a.date ?? "").slice(0, 10);
    const db = String(b.date ?? "").slice(0, 10);
    const c = da.localeCompare(db);
    if (c !== 0) return c;
    return String(a.start_time ?? "").localeCompare(String(b.start_time ?? ""));
  });

  const upcomingShifts = shiftsFreeOnly
    ? upcomingShiftsSorted.filter((s: any) => {
        const required = Number(s.required_slots ?? 1) || 1;
        const taken = (s.shift_assignments ?? []).length;
        return Math.max(0, required - taken) > 0;
      })
    : upcomingShiftsSorted;

  // legacy sections removed in redesign (swap offers + past shifts)

  return (
    <MemberShiftsClient
      orgSlug={orgSlug}
      locale={locale}
      canClaim={canClaim}
      myProfileId={myProfileId}
      memberDisplayName={myDisplayName}
      organizationId={effectiveOrgIdForData}
      shifts={upcomingShifts as any}
      claimShiftAction={claimShiftAction}
      requestShiftTransferAction={requestShiftTransferAction}
      claimShiftSwapAction={claimShiftSwapAction}
      pendingTransferAssignmentIds={[...pendingAssignmentIds]}
      swapOffers={swapOffers as any}
      claimShiftNotice={claimShiftNotice}
    />
  );

}

