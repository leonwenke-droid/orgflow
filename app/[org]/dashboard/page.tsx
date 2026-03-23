import { unstable_noStore } from "next/cache";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { removePastShifts } from "../../../lib/cleanupShifts";
import { getDashboardDisplayNames } from "../../../lib/displayName";
import { formatWeekRangeLabel, formatDateTimeForDisplay, getTodayDateString } from "../../../lib/dateFormat";
import { DEFAULT_CURRENCY, formatCurrency } from "../../../lib/currency";
import ShiftPlanWeekNav from "../../../components/ShiftPlanWeekNav";
import EmptyState from "../../../components/EmptyState";
import OnboardingBanner from "../../../components/OnboardingBanner";
import OnboardingChecklist from "../../../components/OnboardingChecklist";
import { ArrowLeftRight, CheckSquare, Trophy, Users, Wallet } from "lucide-react";
import type { WeekData } from "../../../components/ShiftPlanWeekView";
import { getCurrentOrganization, getCurrentUserOrganization, getOrgIdForData, isSuperAdmin, isOrgAdmin, getCurrentUserRoleInOrg } from "../../../lib/getOrganization";
import { ADMIN_ROLES, canViewFinance } from "../../../lib/permissions";
import {
  localeFromCookie,
  LOCALE_COOKIE_NAME,
  t,
  formatShiftSlotsLabel,
  shiftSlotTrafficClass
} from "../../../lib/i18n";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { claimShiftFromDashboard } from "./actions";
import TaskCompleteModalButton from "../../../components/TaskCompleteModal";
import SubmitButtonWithSpinner from "../../../components/SubmitButtonWithSpinner";
import ClaimShiftRefreshForm from "../../../components/ClaimShiftRefreshForm";

export const dynamic = "force-dynamic";

type ActivityStats = {
  shifts_done_30d: number;
  tasks_done_30d: number;
  materials_30d: number;
  materials_small_30d: number;
  materials_medium_30d: number;
  materials_large_30d: number;
  active_participants_30d: number;
  total_members: number;
};

async function getData(organizationId: string, supabaseOverride?: SupabaseClient) {
  unstable_noStore();
  const supabase = supabaseOverride ?? createServerComponentClient({ cookies });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  const [
    treasuryRes,
    tasksCountRes,
    shiftsRes,
    { data: profiles },
    { data: committees },
    { data: orgProfileIds },
    { data: engagementEvents }
  ] = await Promise.all([
    supabase
      .from("treasury_updates")
      .select("amount, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    supabase
      .from("shifts")
      .select(
        "id, event_name, date, start_time, end_time, location, notes, required_slots, auto_assign, claimable, shift_assignments ( id, status, user_id, replacement_user_id, swap_offered )"
      )
      .eq("organization_id", organizationId)
      .order("date", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", organizationId),
    supabase
      .from("committees")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("name"),
    supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId),
    supabase
      .from("engagement_events")
      .select("user_id, event_type, created_at")
      .gte("created_at", since)
  ]);

  const treasury = treasuryRes.data ?? null;
  const shifts = shiftsRes.data ?? [];

  const profileIds = (orgProfileIds ?? []).map((p: { id: string }) => p.id);
  const eventsFiltered =
    profileIds.length > 0
      ? (engagementEvents ?? []).filter((e: { user_id: string | null }) => e.user_id && profileIds.includes(e.user_id))
      : [];

  try {
    await removePastShifts(supabase);
    await supabase.rpc("apply_task_missed_penalties");
  } catch (e) {
    console.error("[dashboard getData] cleanup/penalties:", e);
  }

  const profileNames = getDashboardDisplayNames(
    (profiles ?? []) as { id: string; full_name: string | null }[]
  );

  const events = eventsFiltered as { user_id: string; event_type: string }[];
  const materialEvents = events.filter((e) =>
    ["material_small", "material_medium", "material_large"].includes(e.event_type)
  );

  const positiveEventTypes = new Set([
    "shift_done",
    "task_done",
    "material_small",
    "material_medium",
    "material_large"
  ]);
  const activeUserIds = events
    .filter((e) => e.user_id && positiveEventTypes.has(e.event_type))
    .map((e) => e.user_id);

  const activity: ActivityStats = {
    shifts_done_30d: events.filter((e) => e.event_type === "shift_done").length,
    tasks_done_30d: events.filter((e) => e.event_type === "task_done").length,
    materials_30d: materialEvents.length,
    materials_small_30d: materialEvents.filter((e) => e.event_type === "material_small").length,
    materials_medium_30d: materialEvents.filter((e) => e.event_type === "material_medium").length,
    materials_large_30d: materialEvents.filter((e) => e.event_type === "material_large").length,
    active_participants_30d: new Set(activeUserIds).size,
    total_members: (profiles ?? []).length
  };

  return {
    treasury: (treasury ?? null) as { amount: number; created_at: string } | null,
    activity,
    shifts: shifts ?? [],
    profileNames,
    committees: (committees ?? []) as { id: string; name: string }[],
    tasksCount: tasksCountRes.count ?? 0,
    shiftsCount: (shifts ?? []).length
  };
}

export default async function OrgDashboardPage({
  params,
  searchParams
}: {
  params: Promise<{ org: string }> | { org: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const orgSlug = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  const sp =
    searchParams && typeof (searchParams as Promise<unknown>).then === "function"
      ? await (searchParams as Promise<Record<string, string | string[] | undefined>>)
      : ((searchParams as Record<string, string | string[] | undefined> | undefined) ?? {});
  const claimShiftError = sp.claimShift === "error" || sp.claimShift === "1";
  const shiftsFreeOnly = sp.free === "1" || sp.free === "true";
  const org = await getCurrentOrganization(orgSlug);
  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const localeForMoney = locale === "de" ? "de-DE" : "en-GB";
  const currencyCode = org.settings?.currency ?? DEFAULT_CURRENCY;

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/dashboard`);
  }

  const service = createSupabaseServiceRoleClient();
  const isSuper = await isSuperAdmin();
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  const { data: myProfilePrimary } = await service
    .from("profiles")
    .select("id, full_name, role")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();
  const { data: myProfileFallback } =
    !myProfilePrimary && orgIdForData !== org.id
      ? await service
          .from("profiles")
          .select("id, full_name, role")
          .eq("auth_user_id", user.id)
          .eq("organization_id", org.id)
          .maybeSingle()
      : { data: null };

  const memberRow = (myProfilePrimary ?? myProfileFallback) as {
    id: string;
    full_name: string | null;
    role: string | null;
  } | null;

  if (!isSuper && !memberRow) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t("common.access_denied", locale)}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t("dashboard.use_invited_account", locale)}
        </p>
      </div>
    );
  }

  const userOrg = await getCurrentUserOrganization();
  const canAccessOrgData = isSuper || userOrg?.id === org.id || !!memberRow;

  const effectiveOrgIdForData = myProfilePrimary ? orgIdForData : org.id;

  let { treasury, activity, shifts, profileNames, committees, tasksCount, shiftsCount } =
    await getData(effectiveOrgIdForData, service);

  const userIsAdminPrimary = await isOrgAdmin(orgIdForData);
  const userIsAdmin =
    userIsAdminPrimary || (orgIdForData !== org.id ? await isOrgAdmin(org.id) : false);

  const userRolePrimary = await getCurrentUserRoleInOrg(orgIdForData);
  const userRole =
    userRolePrimary ?? (orgIdForData !== org.id ? await getCurrentUserRoleInOrg(org.id) : null);
  const showGettingStarted = userRole != null && ADMIN_ROLES.includes(userRole);
  const userCanViewFinance = userRole == null || canViewFinance(userRole) || userIsAdmin;

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const metaName =
    (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta?.name === "string" && meta.name.trim()) ||
    null;
  const emailLocal = user.email?.split("@")[0]?.trim() || null;
  const myName =
    (memberRow?.full_name && String(memberRow.full_name).trim()) ||
    metaName ||
    emailLocal ||
    null;
  const myProfileId = memberRow?.id ?? null;
  const myRole = memberRow?.role ?? null;
  const canClaimShifts = myRole !== "viewer" && !!myProfileId;

  const todayStr = getTodayDateString();
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);
  const orgFeatures = (org.settings?.features as Record<string, boolean> | undefined) ?? {};
  const engagementEnabled = orgFeatures.engagement_tracking !== false;

  const { data: myAssignedShifts } = myProfileId
    ? await service
        .from("shift_assignments")
        .select(
          "id, status, user_id, replacement_user_id, swap_offered, shifts!inner(id, event_name, date, start_time, end_time, location, organization_id)"
        )
        .or(`user_id.eq.${myProfileId},replacement_user_id.eq.${myProfileId}`)
        .eq("shifts.organization_id", effectiveOrgIdForData)
        .gte("shifts.date", todayStr)
        .order("shifts.date", { ascending: true })
        .order("shifts.start_time", { ascending: true })
        .limit(6)
    : { data: [] };

  const { data: myOpenTasks } = myProfileId
    ? await service
        .from("tasks")
        .select(
          "id, title, description, status, due_at, claimable, proof_required, proof_url, committees(name)"
        )
        .eq("organization_id", effectiveOrgIdForData)
        .eq("owner_id", myProfileId)
        .neq("status", "erledigt")
        .order("due_at", { ascending: true })
        .limit(8)
    : { data: [] };

  let myOpenTaskCount = 0;
  if (myProfileId) {
    const { count } = await service
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", effectiveOrgIdForData)
      .eq("owner_id", myProfileId)
      .neq("status", "erledigt");
    myOpenTaskCount = count ?? 0;
  }

  const { data: engagementRows } =
    engagementEnabled && myProfileId
      ? await service
          .from("engagement_scores")
          .select("user_id, score")
          .eq("organization_id", effectiveOrgIdForData)
          .order("score", { ascending: false })
      : { data: [] };

  const myEngagementScoreRow = (engagementRows ?? []).find((row) => row.user_id === myProfileId);
  const myEngagementScore = typeof myEngagementScoreRow?.score === "number" ? myEngagementScoreRow.score : 0;
  const myEngagementRank =
    myEngagementScoreRow && engagementRows
      ? 1 + (engagementRows ?? []).filter((row) => (row.score ?? 0) > myEngagementScore).length
      : null;
  const engagementRankingTotal = (engagementRows ?? []).length;

  const { data: poolClaimableTasks } =
    myProfileId && canClaimShifts
      ? await service
          .from("tasks")
          .select("id, title, due_at, claimable, committees(name)")
          .eq("organization_id", effectiveOrgIdForData)
          .is("owner_id", null)
          .eq("claimable", true)
          .in("status", ["offen", "in_arbeit"])
          .order("due_at", { ascending: true })
          .limit(6)
      : { data: [] };

  const shiftRows = (shifts ?? []) as {
    date: string;
    id: string;
    start_time?: string | null;
    end_time?: string | null;
    event_name?: string | null;
    required_slots?: number | null;
    auto_assign?: boolean | null;
    claimable?: boolean | null;
    shift_assignments?: { id: string; user_id?: string | null; replacement_user_id?: string | null }[];
  }[];

  const claimableForDashboard = canClaimShifts
    ? shiftRows.filter((s) => {
        const d = String(s.date ?? "").slice(0, 10);
        if (!d || d < todayStr) return false;
        if (s.auto_assign === true) return false;
        if (s.claimable === false) return false;
        const required = Number(s.required_slots ?? 1) || 1;
        const taken = (s.shift_assignments ?? []).length;
        return taken < required;
      })
    : [];

  const upcomingShiftsNext7Days = [...shiftRows]
    .filter((s) => {
      const d = String(s.date ?? "").slice(0, 10);
      return d && d >= todayStr && d <= in7Str;
    })
    .sort((a, b) => {
      const da = String(a.date ?? "").slice(0, 10);
      const db = String(b.date ?? "").slice(0, 10);
      const cmp = da.localeCompare(db);
      if (cmp !== 0) return cmp;
      return String(a.start_time ?? "").localeCompare(String(b.start_time ?? ""));
    });

  const claimableShiftsAfter7Days = claimableForDashboard.filter((s) => {
    const d = String(s.date ?? "").slice(0, 10);
    return d > in7Str;
  });

  const shiftHasFreeSlot = (s: (typeof shiftRows)[number]) => {
    const required = Number(s.required_slots ?? 1) || 1;
    const taken = (s.shift_assignments ?? []).length;
    return Math.max(0, required - taken) > 0;
  };

  const upcomingShiftsNext7DaysDisplay = shiftsFreeOnly
    ? upcomingShiftsNext7Days.filter(shiftHasFreeSlot)
    : upcomingShiftsNext7Days;

  const freeSlotsInSevenDayHero = upcomingShiftsNext7DaysDisplay.filter(shiftHasFreeSlot).length;
  const poolTaskCount = (poolClaimableTasks ?? []).length;
  const overdueMyTasks = (myOpenTasks ?? []).filter((task: { due_at?: string | null }) => {
    if (!task?.due_at) return false;
    return new Date(task.due_at).getTime() < Date.now();
  }).length;

  const livechartCommittees = committees.filter(
    (c) => !/Jahrgangssprecher/i.test(c.name)
  );

  const orgHeaderLabel = (org.school_short && String(org.school_short).trim()) || org.name;

  return (
    <div className="space-y-6">
      <header className="border-b border-gray-200 pb-3 dark:border-gray-700">
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          <span>
            {myName
              ? t("dashboard.greeting_named", locale).replace("{name}", myName)
              : t("dashboard.greeting", locale)}
          </span>
          <span className="ml-1 font-normal" aria-hidden>
            👋
          </span>
        </h1>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {orgHeaderLabel} – {t("dashboard.overview_short", locale)}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500/90 dark:text-gray-400/90">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5 shrink-0 opacity-45" aria-hidden />
            <span>
              {t("dashboard.header_stat_members", locale).replace(
                "{count}",
                String(activity.total_members)
              )}
            </span>
          </span>
          <span className="select-none text-gray-300 dark:text-gray-600" aria-hidden>
            |
          </span>
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="h-3.5 w-3.5 shrink-0 opacity-45" aria-hidden />
            <span>
              {t("dashboard.header_stat_open_tasks", locale).replace(
                "{count}",
                String(myOpenTaskCount)
              )}
            </span>
          </span>
          {userCanViewFinance ? (
            <>
              <span className="select-none text-gray-300 dark:text-gray-600" aria-hidden>
                |
              </span>
              <span className="inline-flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5 shrink-0 opacity-45" aria-hidden />
                <span>
                  {treasury ? formatCurrency(treasury.amount, localeForMoney, currencyCode) : "–"}
                </span>
              </span>
            </>
          ) : null}
        </p>
      </header>

      {claimShiftError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100">
          {t("dashboard.claim_shift_failed", locale)}
        </p>
      )}

      {!engagementEnabled && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
          {t("dashboard.engagement_disabled_note", locale)}
        </p>
      )}

      {(freeSlotsInSevenDayHero > 0 || poolTaskCount > 0 || overdueMyTasks > 0) && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/90 px-4 py-3 text-sm dark:border-blue-900/60 dark:bg-blue-950/40">
          <p className="font-semibold text-blue-900 dark:text-blue-100">
            {t("dashboard.action_now_title", locale)}
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-blue-900/90 dark:text-blue-100/90">
            {freeSlotsInSevenDayHero > 0 ? (
              <li>
                {t("dashboard.action_free_shifts", locale).replace(
                  "{count}",
                  String(freeSlotsInSevenDayHero)
                )}
              </li>
            ) : null}
            {poolTaskCount > 0 ? (
              <li>
                {t("dashboard.action_pool_tasks", locale).replace("{count}", String(poolTaskCount))}
              </li>
            ) : null}
            {overdueMyTasks > 0 ? (
              <li>
                {t("dashboard.action_overdue_tasks", locale).replace(
                  "{count}",
                  String(overdueMyTasks)
                )}
              </li>
            ) : null}
          </ul>
        </div>
      )}

      {engagementEnabled && myProfileId && (
        <section className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <Trophy className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" aria-hidden />
            <span>{t("dashboard.my_engagement", locale)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
            <span>
              <span className="text-gray-500 dark:text-gray-400">{t("dashboard.my_engagement_score", locale)}:</span>{" "}
              <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{myEngagementScore}</span>
            </span>
            <span className="select-none text-gray-300 dark:text-gray-600" aria-hidden>
              |
            </span>
            <span>
              <span className="text-gray-500 dark:text-gray-400">{t("dashboard.my_engagement_rank", locale)}:</span>{" "}
              <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {myEngagementRank != null
                  ? t("dashboard.my_engagement_rank_of", locale)
                      .replace("{rank}", String(myEngagementRank))
                      .replace("{total}", String(engagementRankingTotal))
                  : t("dashboard.my_engagement_rank_unranked", locale)}
              </span>
            </span>
          </div>
        </section>
      )}

      <section
        id="dashboard-upcoming-shifts"
        className="rounded-xl border-2 border-blue-100 bg-white p-5 shadow-md dark:border-blue-900/40 dark:bg-card-dark"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-100">
                {t("dashboard.upcoming_shifts_7d_title", locale)}
              </h2>
              <a
                className="shrink-0 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                href={`/${orgSlug}/shifts`}
              >
                {t("common.view", locale)}
              </a>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 text-xs">
            <a
              href={`/${orgSlug}/dashboard`}
              className={`rounded-full border px-3 py-1 ${
                !shiftsFreeOnly
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300"
              }`}
            >
              {t("dashboard.filter_all_shifts", locale)}
            </a>
            <a
              href={`/${orgSlug}/dashboard?free=1`}
              className={`rounded-full border px-3 py-1 ${
                shiftsFreeOnly
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300"
              }`}
            >
              {t("dashboard.filter_free_shifts", locale)}
            </a>
          </div>
        </div>
        {upcomingShiftsNext7DaysDisplay.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("empty.shifts", locale)}</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {upcomingShiftsNext7DaysDisplay.map((s) => {
              const required = Number(s.required_slots ?? 1) || 1;
              const taken = (s.shift_assignments ?? []).length;
              const free = Math.max(0, required - taken);
              const d = String(s.date ?? "").slice(0, 10);
              const imAssigned =
                !!myProfileId &&
                (s.shift_assignments ?? []).some(
                  (a) =>
                    a.user_id === myProfileId || a.replacement_user_id === myProfileId
                );
              const canShowClaim =
                canClaimShifts &&
                s.auto_assign !== true &&
                s.claimable !== false &&
                free > 0 &&
                !imAssigned;
              let statusHint: string | null = null;
              if (imAssigned) statusHint = t("dashboard.shift_you_signed_up", locale);
              else if (s.auto_assign === true)
                statusHint = t("dashboard.shift_auto_assign_hint", locale);
              else if (s.claimable === false)
                statusHint = t("dashboard.shift_not_self_signup", locale);
              else if (free === 0) statusHint = t("dashboard.shift_slots_full", locale);
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {s.event_name || t("dashboard.shifts", locale)}
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <span
                        className={`inline-block h-2 w-2 shrink-0 rounded-full ${shiftSlotTrafficClass(free, required)}`}
                        title={formatShiftSlotsLabel(locale, free, required)}
                        aria-hidden
                      />
                      <span>
                        {d ? formatDateTimeForDisplay(d) : "–"} · {formatShiftSlotsLabel(locale, free, required)}
                        {statusHint ? ` · ${statusHint}` : ""}
                      </span>
                    </p>
                  </div>
                  {canShowClaim ? (
                    <ClaimShiftRefreshForm action={claimShiftFromDashboard} className="inline">
                      <input type="hidden" name="orgSlug" value={orgSlug} />
                      <input type="hidden" name="shiftId" value={s.id} />
                      <input type="hidden" name="organization_id" value={effectiveOrgIdForData} />
                      <SubmitButtonWithSpinner
                        className="inline-flex min-w-[7rem] items-center justify-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-70"
                        loadingLabel={t("common.loading", locale)}
                      >
                        {t("shifts.claim", locale)}
                      </SubmitButtonWithSpinner>
                    </ClaimShiftRefreshForm>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {claimableShiftsAfter7Days.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t("dashboard.more_claimable_shifts_title", locale)}
            </h2>
            <a className="text-xs text-blue-600 hover:underline dark:text-blue-400" href={`/${orgSlug}/shifts`}>
              {t("common.view", locale)}
            </a>
          </div>
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {claimableShiftsAfter7Days.map((s) => {
              const required = Number(s.required_slots ?? 1) || 1;
              const taken = (s.shift_assignments ?? []).length;
              const free = Math.max(0, required - taken);
              const d = String(s.date ?? "").slice(0, 10);
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {s.event_name || t("dashboard.shifts", locale)}
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <span
                        className={`inline-block h-2 w-2 shrink-0 rounded-full ${shiftSlotTrafficClass(free, required)}`}
                        title={formatShiftSlotsLabel(locale, free, required)}
                        aria-hidden
                      />
                      <span>
                        {d ? formatDateTimeForDisplay(d) : "–"} · {formatShiftSlotsLabel(locale, free, required)}
                      </span>
                    </p>
                  </div>
                  <ClaimShiftRefreshForm action={claimShiftFromDashboard} className="inline">
                    <input type="hidden" name="orgSlug" value={orgSlug} />
                    <input type="hidden" name="shiftId" value={s.id} />
                    <input type="hidden" name="organization_id" value={effectiveOrgIdForData} />
                    <SubmitButtonWithSpinner
                      className="inline-flex min-w-[7rem] items-center justify-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-70"
                      loadingLabel={t("common.loading", locale)}
                    >
                      {t("shifts.claim", locale)}
                    </SubmitButtonWithSpinner>
                  </ClaimShiftRefreshForm>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(myAssignedShifts ?? []).length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {t("dashboard.my_assigned_shifts", locale)}
            </h2>
            <a className="text-xs text-blue-600 hover:underline dark:text-blue-400" href={`/${orgSlug}/shifts`}>
              {t("common.view", locale)}
            </a>
          </div>
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {(myAssignedShifts ?? []).map((a: any) => {
              const s = a.shifts;
              return (
                <li key={a.id} className="py-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {a.swap_offered ? (
                      <span title={t("dashboard.swap_offered_hint", locale)}>
                        <ArrowLeftRight
                          className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                          aria-hidden
                        />
                      </span>
                    ) : null}
                    <span>{s?.event_name || t("dashboard.shifts", locale)}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {s?.date
                      ? `${formatDateTimeForDisplay(s.date)} · ${String(s.start_time ?? "")}-${String(s.end_time ?? "")}`
                      : "–"}
                    {s?.location ? ` · ${s.location}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(poolClaimableTasks ?? []).length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t("dashboard.pool_tasks_title", locale)}
          </h2>
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {(poolClaimableTasks ?? []).map((task: any) => (
              <li key={task.id} className="flex items-start gap-2 py-2">
                <span title={t("dashboard.task_claimable_hint", locale)}>
                  <ArrowLeftRight
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400"
                    aria-hidden
                  />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{task.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(task.committees as { name?: string } | null)?.name ?? "–"}
                    {task.due_at
                      ? ` · ${new Date(task.due_at).toLocaleString(locale === "de" ? "de-DE" : "en-GB")}`
                      : ""}
                  </p>
                </div>
                <a
                  href={`/${orgSlug}/tasks`}
                  className="shrink-0 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {t("tasks.claim", locale)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {false && (
        <section className="mb-2">
          <h2 className="mb-2 text-sm font-semibold text-gray-600">
            Livecharts per team
          </h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7">
            {livechartCommittees.map((c) => (
              <div
                key={c.id}
                className="flex h-16 min-w-0 flex-col items-center justify-center rounded border border-gray-200 bg-white px-1.5 py-1 text-center shadow-sm"
              >
                <span
                  className="w-full truncate text-[10px] font-semibold text-gray-700"
                  title={c.name}
                >
                  {c.name}
                </span>
                <span className="text-[9px] text-gray-500">Chart</span>
              </div>
            ))}
            {livechartCommittees.length === 0 && (
              <p className="col-span-full py-2 text-xs text-gray-500">
                No teams created yet.
              </p>
            )}
          </div>
        </section>
      )}

      <section
        id="dashboard-my-open-tasks"
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-card-dark"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {t("dashboard.my_open_tasks", locale)}
        </h2>
        {(myOpenTasks ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("empty.tasks", locale)}</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {(myOpenTasks ?? []).map((task: any) => (
              <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{task.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {(task.committees as any)?.name ?? "–"}
                    {task.due_at
                      ? ` · ${new Date(task.due_at).toLocaleString(locale === "de" ? "de-DE" : "en-GB")}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <TaskCompleteModalButton
                    orgSlug={orgSlug}
                    task={{
                      id: task.id,
                      title: task.title,
                      description: task.description ?? null,
                      due_at: task.due_at ?? null,
                      status: task.status,
                      proof_required: !!task.proof_required,
                      proof_url: task.proof_url ?? null
                    }}
                    className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                  />
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {task.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {t("dashboard.shift_plan", locale)}
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            {t("dashboard.shift_plan_hint", locale)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          {!shifts || shifts.length === 0 ? (
            <EmptyState
              messageKey="empty.shifts"
              actionHref={userIsAdmin ? `/${orgSlug}/admin/shifts` : `/${orgSlug}/shifts`}
              actionLabelKey={userIsAdmin ? "cta.create_shift" : "cta.member_shifts_page"}
              {...(userIsAdmin
                ? {
                    secondaryActionHref: `/${orgSlug}/shifts`,
                    secondaryActionLabelKey: "cta.member_shifts_page"
                  }
                : {})}
            />
          ) : (
            (() => {
              const toDateKey = (d: unknown) => {
                if (d == null) return "";
                const str =
                  typeof d === "string" ? d : new Date(d as string).toISOString();
                return str.slice(0, 10);
              };
              const byDate = (shifts as { date: unknown }[]).reduce(
                (acc: Record<string, unknown[]>, s: { date: unknown }) => {
                  const d = toDateKey(s.date);
                  if (!d) return acc;
                  if (!acc[d]) acc[d] = [];
                  acc[d].push(s);
                  return acc;
                },
                {}
              );
              const getMonday = (dateStr: string) => {
                const ymd = dateStr.slice(0, 10);
                const d = new Date(ymd + "T12:00:00Z");
                const day = d.getUTCDay();
                const diff = day === 0 ? 6 : day - 1;
                d.setUTCDate(d.getUTCDate() - diff);
                return d.toISOString().slice(0, 10);
              };
              const weekKeys = new Set<string>();
              Object.keys(byDate).forEach((dateStr) => {
                const mon = getMonday(dateStr);
                if (mon) weekKeys.add(mon);
              });
              const todayStr = getTodayDateString();
              const todayMonday = getMonday(todayStr);
              weekKeys.add(todayMonday);
              for (let i = -2; i <= 4; i++) {
                const d = new Date(todayStr + "T12:00:00Z");
                d.setUTCDate(d.getUTCDate() + i * 7);
                weekKeys.add(getMonday(d.toISOString().slice(0, 10)));
              }
              const WEEKDAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
              const daySlots = (monday: string) => {
                const out: string[] = [];
                const d = new Date(monday + "Z");
                for (let i = 0; i < 7; i++) {
                  const x = new Date(d);
                  x.setUTCDate(d.getUTCDate() + i);
                  out.push(x.toISOString().slice(0, 10));
                }
                return out;
              };
              const weeksData: WeekData[] = Array.from(weekKeys)
                .sort()
                .map((monday) => {
                  const days = daySlots(monday);
                  const weekLabel = formatWeekRangeLabel(monday, days[6]);
                  return {
                    weekLabel,
                    monday,
                    days: days.map((dateStr, i) => {
                      const dayShifts = (byDate[dateStr] ?? []) as {
                        id: string;
                        event_name: string | null;
                        start_time: unknown;
                        end_time: unknown;
                        location: string | null;
                        notes: string | null;
                        required_slots?: number | null;
                        claimable?: boolean | null;
                        auto_assign?: boolean | null;
                        shift_assignments?: {
                          id: string;
                          status: string;
                          user_id?: string | null;
                          replacement_user_id?: string | null;
                          swap_offered?: boolean | null;
                        }[];
                      }[];
                      const sorted = [...dayShifts].sort((a, b) =>
                        String(a.start_time).localeCompare(String(b.start_time))
                      );
                      const first = sorted[0];
                      const dayTitle = first
                        ? ((first.event_name ?? "")
                            .replace(/\s*–\s*[12]\. Pause$/i, "")
                            .trim() ||
                            (first.event_name ?? ""))
                        : null;
                      return {
                        dateStr,
                        weekdayName: WEEKDAY_NAMES[i],
                        dayTitle: dayTitle || null,
                        location: first?.location ?? null,
                        notes: first?.notes ?? null,
                        shifts: sorted.map((s) => ({
                          id: s.id,
                          event_name: s.event_name ?? "",
                          start_time: String(s.start_time ?? ""),
                          end_time: String(s.end_time ?? ""),
                          required_slots: s.required_slots ?? 1,
                          claimable: s.claimable !== false,
                          auto_assign: s.auto_assign === true,
                          assignments: (
                            (s.shift_assignments ?? []) as {
                              id: string;
                              status: string;
                              user_id?: string | null;
                              replacement_user_id?: string | null;
                            }[]
                          ).map((a) => ({
                            id: a.id,
                            status: a.status ?? "zugewiesen",
                            user_id: a.user_id ?? null,
                            replacement_user_id: a.replacement_user_id ?? null,
                            swap_offered: !!(a as { swap_offered?: boolean }).swap_offered
                          }))
                        }))
                      };
                    })
                  };
                });
              const currentWeekIndex = weeksData.findIndex(
                (w) => w.monday === todayMonday
              );
              const profileNamesObj: Record<string, string> = {};
              profileNames.forEach((value, key) => {
                profileNamesObj[key] = value;
              });
              return (
                <ShiftPlanWeekNav
                  weeks={weeksData}
                  currentWeekIndex={currentWeekIndex >= 0 ? currentWeekIndex : 0}
                  profileNames={profileNamesObj}
                  orgSlug={orgSlug}
                  showClaimButton={canClaimShifts}
                  organizationId={effectiveOrgIdForData}
                />
              );
            })()
          )}
        </div>
      </section>

      {showGettingStarted && <OnboardingBanner />}

      {showGettingStarted && canAccessOrgData && (
        <OnboardingChecklist
          orgSlug={orgSlug}
          teamsCount={committees.length}
          membersCount={activity.total_members}
          tasksOrShiftsCount={tasksCount + shiftsCount}
          isAdmin={userIsAdmin}
        />
      )}
    </div>
  );
}
