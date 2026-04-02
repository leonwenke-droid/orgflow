import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getRequestLocale } from "../../../lib/localeServer";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { t } from "../../../lib/i18n";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { claimShiftAction } from "./actions";
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
  // claim errors / swaps are handled on the full shifts flow; redesign focuses on sign-up list UI

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  const locale = await getRequestLocale();

  const authSupabase = createServerComponentClient({ cookies });
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/shifts`);

  const service = createSupabaseServiceRoleClient();
  const { data: mePrimary } = await service
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();

  // Legacy-Mapping: Profile können unter der kanonischen org.id liegen.
  const { data: meFallback } = (!mePrimary && orgIdForData !== org.id)
    ? await service
        .from("profiles")
        .select("id, role")
        .eq("auth_user_id", user.id)
        .eq("organization_id", org.id)
        .maybeSingle()
    : { data: null };

  const myProfile = (mePrimary ?? meFallback) as { id?: string; role?: string } | null;
  const myProfileId = myProfile?.id ?? null;
  const myRole = myProfile?.role ?? null;

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
    .select("id, event_name, date, start_time, end_time, location, required_slots, auto_assign, claimable, shift_assignments(id, user_id, replacement_user_id, status, swap_offered)")
    .eq("organization_id", effectiveOrgIdForData)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

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
      organizationId={effectiveOrgIdForData}
      shifts={upcomingShifts as any}
      claimShiftAction={claimShiftAction}
    />
  );

}

