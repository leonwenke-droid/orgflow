import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../../lib/i18n";
import { revalidatePath } from "next/cache";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { createUserNotification } from "../../../lib/notifications";

export const dynamic = "force-dynamic";

async function claimShiftAction(formData: FormData) {
  "use server";
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const shiftId = String(formData.get("shiftId") ?? "").trim();
  if (!orgSlug || !shiftId) return;

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("claim_shift_slot", { shift_id: shiftId });
  revalidatePath(`/${orgSlug}/shifts`);
  revalidatePath(`/${orgSlug}/dashboard`);
}

async function offerShiftSwapAction(formData: FormData) {
  "use server";
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  if (!orgSlug || !assignmentId) return;

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("offer_shift_swap", { assignment_id: assignmentId });
  revalidatePath(`/${orgSlug}/shifts`);
  revalidatePath(`/${orgSlug}/dashboard`);
}

async function claimShiftSwapAction(formData: FormData) {
  "use server";
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  if (!orgSlug || !assignmentId || !organizationId) return;

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const service = createSupabaseServiceRoleClient();
  const { data: before } = await service
    .from("shift_assignments")
    .select("user_id, shift_id, shifts(event_name)")
    .eq("id", assignmentId)
    .maybeSingle();
  const originalOwnerId = (before as { user_id?: string } | null)?.user_id ?? null;

  const { error: rpcErr } = await supabase.rpc("claim_shift_swap", { assignment_id: assignmentId });
  if (rpcErr) return;

  const { data: claimerProf } = await service
    .from("profiles")
    .select("id, full_name")
    .eq("auth_user_id", user.id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (originalOwnerId) {
    const evName =
      (before as { shifts?: { event_name?: string } | null } | null)?.shifts?.event_name ?? "Schicht";
    const claimerName = (claimerProf as { full_name?: string } | null)?.full_name ?? "Jemand";
    await createUserNotification(service, {
      profileId: originalOwnerId,
      organizationId,
      type: "shift_swap_taken",
      title: "Schicht-Tausch übernommen",
      body: `${claimerName} hat dein Angebot für „${evName}“ übernommen.`,
      link: `/${orgSlug}/shifts`
    });
  }

  revalidatePath(`/${orgSlug}/shifts`);
  revalidatePath(`/${orgSlug}/dashboard`);
}

export default async function ShiftsViewerPage(props: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const params = typeof (props.params as Promise<{ org: string }>).then === "function"
    ? await (props.params as Promise<{ org: string }>)
    : (props.params as { org: string });
  const orgSlug = params.org;

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const localeForDate = locale === "de" ? "de-DE" : "en-GB";

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

  // Legacy/TGG fallback: profiles können unter der "rohen" org.id liegen.
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

  const myShifts = (shifts ?? []).filter((s: any) =>
    (s.shift_assignments ?? []).some((a: any) => a.user_id === myProfileId || a.replacement_user_id === myProfileId)
  );
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingShifts = (shifts ?? []).filter((s: any) => {
    // If date is present, hide past shifts. If date is missing (event-type), keep them visible.
    return !s.date || String(s.date).slice(0, 10) >= todayStr;
  });

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

      {upcomingShifts.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{t("dashboard.upcoming_shifts", locale)}</h2>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {upcomingShifts.map((s: any) => {
              const required = Number(s.required_slots ?? 1) || 1;
              const taken = (s.shift_assignments ?? []).length;
              const free = Math.max(0, required - taken);
              return (
                <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{s.event_name || t("dashboard.shifts", locale)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {s.date ? new Date(s.date).toLocaleDateString(localeForDate) : "–"} · {s.start_time ?? ""}-{s.end_time ?? ""}
                      {s.location ? ` · ${s.location}` : ""}
                      {` · ${free}/${required} free`}
                    </p>
                  </div>
                  {canClaim && (s.auto_assign !== true) && (s.claimable !== false) && free > 0 ? (
                    <form action={claimShiftAction}>
                      <input type="hidden" name="orgSlug" value={orgSlug} />
                      <input type="hidden" name="shiftId" value={s.id} />
                      <button className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                        {t("shifts.claim", locale)}
                      </button>
                    </form>
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
                    {shift.date ? new Date(shift.date).toLocaleDateString(localeForDate) : "–"} · {shift.start_time ?? ""}-{shift.end_time ?? ""}
                    {shift.location ? ` · ${shift.location}` : ""}
                  </p>
                </div>
                {canClaim ? (
                  <form action={claimShiftSwapAction}>
                    <input type="hidden" name="orgSlug" value={orgSlug} />
                    <input type="hidden" name="organization_id" value={effectiveOrgIdForData} />
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <button className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                      {t("shifts.take_over", locale)}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{t("shifts.my_shifts", locale)}</h2>
        {myShifts.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("empty.shifts", locale)}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {myShifts.map((s: any) => (
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
                            <button className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
                              {t("shifts.offer_swap", locale)}
                            </button>
                          </form>
                        ))}
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {s.date ? new Date(s.date).toLocaleDateString(localeForDate) : "–"} · {s.start_time ?? ""}-{s.end_time ?? ""}
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

