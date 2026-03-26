import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getRequestLocale } from "../../../lib/localeServer";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { t } from "../../../lib/i18n";
import { formatShiftSlot, type AppLocale } from "../../../lib/formatDate";
import { ShiftAvailability } from "../../../components/ui/ShiftAvailability";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import SubmitButtonWithSpinner from "../../../components/SubmitButtonWithSpinner";
import ClaimShiftRefreshForm from "../../../components/ClaimShiftRefreshForm";
import EmptyState from "../../../components/EmptyState";
import { claimShiftAction, claimShiftSwapAction, offerShiftSwapAction } from "./actions";

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
  const claimShiftError = sp.claimShift === "error" || sp.claimShift === "1";
  const shiftsFreeOnly = sp.free === "1" || sp.free === "true";
  const swapStatus = String(sp.swap ?? "").trim();

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
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("common.access_denied", locale)}</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("dashboard.use_invited_account", locale)}</p>
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

  const myPastShifts = myShifts.filter((s: any) => s.date && String(s.date).slice(0, 10) < todayStr);

  const openSwapOffers = (shifts ?? []).flatMap((s: any) => {
    const offers = (s.shift_assignments ?? []).filter((a: any) =>
      a.swap_offered === true && !a.replacement_user_id && a.user_id !== myProfileId
    );
    return offers.map((a: any) => ({ shift: s, assignment: a }));
  });

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("dashboard.shifts", locale)}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{org.name}</p>
        </div>
        <Link href={`/${orgSlug}/dashboard`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          {t("common.back", locale)}
        </Link>
      </div>

      {claimShiftError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100">
          {t("dashboard.claim_shift_failed", locale)}
        </p>
      )}
      {swapStatus === "offered" && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100">
          {t("shifts.swap_offer_success", locale)}
        </p>
      )}
      {swapStatus === "taken" && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100">
          {t("shifts.swap_take_success", locale)}
        </p>
      )}
      {swapStatus === "error" && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100">
          {t("dashboard.claim_shift_failed", locale)}
        </p>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        <a
          href={`/${orgSlug}/shifts`}
          className={`rounded-full border px-3 py-1 ${
            !shiftsFreeOnly
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300"
          }`}
        >
          {t("dashboard.filter_all_shifts", locale)}
        </a>
        <a
          href={`/${orgSlug}/shifts?free=1`}
          className={`rounded-full border px-3 py-1 ${
            shiftsFreeOnly
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300"
          }`}
        >
          {t("dashboard.filter_free_shifts", locale)}
        </a>
      </div>

      {upcomingShifts.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{t("dashboard.upcoming_shifts", locale)}</h2>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{t("shifts.upcoming_sort_hint", locale)}</p>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {upcomingShifts.map((s: any) => {
              const required = Number(s.required_slots ?? 1) || 1;
              const taken = (s.shift_assignments ?? []).length;
              const free = Math.max(0, required - taken);
              const imAssigned = isAssignedToMe(s);
              const showClaim =
                canClaim &&
                s.auto_assign !== true &&
                s.claimable !== false &&
                free > 0 &&
                !imAssigned;
              return (
                <li key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                      <span>{s.event_name || t("dashboard.shifts", locale)}</span>
                      {imAssigned ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800 dark:bg-blue-900/40 dark:text-blue-100">
                          {t("shifts.you_are_signed_up", locale)}
                        </span>
                      ) : null}
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <ShiftAvailability
                        free={free}
                        required={required}
                        locale={locale}
                        textClassName="text-xs text-gray-500 dark:text-gray-400"
                      />
                      <span>
                        {s.date
                          ? formatShiftSlot(String(s.date), s.start_time, s.end_time, locale as AppLocale)
                          : "–"}
                        {s.location ? ` · ${s.location}` : ""}
                      </span>
                    </p>
                  </div>
                  {showClaim ? (
                    <ClaimShiftRefreshForm action={claimShiftAction} className="inline">
                      <input type="hidden" name="orgSlug" value={orgSlug} />
                      <input type="hidden" name="organization_id" value={effectiveOrgIdForData} />
                      <input type="hidden" name="shiftId" value={s.id} />
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
        </div>
      )}

      {openSwapOffers.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{t("shifts.offer_swap", locale)}</h2>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {openSwapOffers.map(({ shift, assignment }: any) => (
              <li key={assignment.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{shift.event_name || t("dashboard.shifts", locale)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {shift.date
                      ? formatShiftSlot(String(shift.date), shift.start_time, shift.end_time, locale as AppLocale)
                      : "–"}
                    {shift.location ? ` · ${shift.location}` : ""}
                  </p>
                </div>
                {canClaim ? (
                  <form action={claimShiftSwapAction}>
                    <input type="hidden" name="orgSlug" value={orgSlug} />
                    <input type="hidden" name="organization_id" value={effectiveOrgIdForData} />
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <SubmitButtonWithSpinner
                      className="inline-flex items-center justify-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-70"
                      loadingLabel={t("common.loading", locale)}
                    >
                      {t("shifts.take_over", locale)}
                    </SubmitButtonWithSpinner>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{t("shifts.my_past_shifts", locale)}</h2>
        {myPastShifts.length === 0 ? (
          <EmptyState
            messageKey="shifts.no_past_shifts"
            actionHref={`/${orgSlug}/dashboard`}
            actionLabelKey="common.back"
          />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {myPastShifts.map((s: any) => (
              <li key={s.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{s.event_name || t("dashboard.shifts", locale)}</p>
                  {canClaim && (
                    <>
                      {(s.shift_assignments ?? [])
                        .filter((a: any) => a.user_id === myProfileId && !a.replacement_user_id && a.swap_offered !== true)
                        .slice(0, 1)
                        .map((a: any) => (
                          <form key={a.id} action={offerShiftSwapAction}>
                            <input type="hidden" name="orgSlug" value={orgSlug} />
                            <input type="hidden" name="assignmentId" value={a.id} />
                            <SubmitButtonWithSpinner
                              className="inline-flex items-center justify-center gap-1.5 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-70 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                              loadingLabel={t("common.loading", locale)}
                            >
                              {t("shifts.offer_swap", locale)}
                            </SubmitButtonWithSpinner>
                          </form>
                        ))}
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {s.date
                    ? formatShiftSlot(String(s.date), s.start_time, s.end_time, locale as AppLocale)
                    : "–"}
                  {s.location ? ` · ${s.location}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

