import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getRequestLocale } from "../../../lib/localeServer";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { t } from "../../../lib/i18n";
import { formatLocaleDateTime, formatCalendarDateYmd, formatShiftClockRange } from "../../../lib/formatDate";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function MyStatsPage(props: { params: Promise<{ org: string }> | { org: string } }) {
  const params = typeof (props.params as Promise<{ org: string }>).then === "function"
    ? await (props.params as Promise<{ org: string }>)
    : (props.params as { org: string });
  const orgSlug = params.org;

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  const locale = await getRequestLocale();

  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/me`);

  // Use service-role for the profile lookup and stats reads:
  // RLS org-mapping for legacy orgs can otherwise cause "my profile not found".
  const service = createSupabaseServiceRoleClient();

  const { data: mePrimary } = await service
    .from("profiles")
    .select("id, full_name")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();

  const { data: meFallback } = (!mePrimary && orgIdForData !== org.id)
    ? await service
        .from("profiles")
        .select("id, full_name")
        .eq("auth_user_id", user.id)
        .eq("organization_id", org.id)
        .maybeSingle()
    : { data: null };

  const me = (mePrimary ?? meFallback) as any;
  const effectiveOrgIdForData = mePrimary ? orgIdForData : org.id;
  const myProfileId = me?.id as string | undefined;
  if (!myProfileId) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("common.access_denied", locale)}</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("dashboard.use_invited_account", locale)}</p>
        </div>
      </div>
    );
  }

  const orgFeatures = (org.settings?.features as Record<string, boolean> | undefined) ?? {};
  const engagementEnabled = orgFeatures.engagement_tracking !== false;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  const [
    { data: scoreRow },
    { data: myEvents },
    { data: myTasks },
    { data: myAssignments },
    { data: allOrgScores },
  ] = await Promise.all([
    service
      .from("engagement_scores")
      .select("score, updated_at")
      .eq("user_id", myProfileId)
      .eq("organization_id", effectiveOrgIdForData)
      .maybeSingle(),
    service
      .from("engagement_events")
      .select("event_type, created_at, points")
      .eq("user_id", myProfileId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200),
    service
      .from("tasks")
      .select("id, status, due_at")
      .eq("organization_id", effectiveOrgIdForData)
      .eq("owner_id", myProfileId),
    service
      .from("shift_assignments")
      .select("id, status, shift_id, replacement_user_id, shifts(date, start_time, end_time, event_name)")
      .or(`user_id.eq.${myProfileId},replacement_user_id.eq.${myProfileId}`)
      .order("created_at", { ascending: false })
      .limit(200),
    engagementEnabled
      ? service.from("engagement_scores").select("user_id, score").eq("organization_id", effectiveOrgIdForData)
      : Promise.resolve({ data: [] as { user_id: string; score: number }[] }),
  ]);

  const score = (scoreRow as any)?.score ?? 0;
  const updatedAt = (scoreRow as any)?.updated_at
    ? formatLocaleDateTime(String((scoreRow as any).updated_at), locale)
    : null;

  const rankRows = (allOrgScores ?? []) as { user_id: string; score: number }[];
  const totalRanked = rankRows.length;
  const myNumeric = Number(score);
  const rank =
    engagementEnabled && totalRanked > 0
      ? rankRows.filter((r) => Number(r.score) > myNumeric).length + 1
      : null;

  const events = (myEvents ?? []) as any[];
  const counts = {
    shift_done_30d: events.filter((e) => e.event_type === "shift_done").length,
    task_done_30d: events.filter((e) => e.event_type === "task_done").length,
    materials_30d: events.filter((e) => ["material_small", "material_medium", "material_large"].includes(e.event_type)).length,
  };

  const tasks = (myTasks ?? []) as any[];
  const taskStats = {
    open: tasks.filter((x) => x.status === "offen").length,
    in_progress: tasks.filter((x) => x.status === "in_arbeit").length,
    done: tasks.filter((x) => x.status === "erledigt").length,
    overdue: tasks.filter((x) => x.status !== "erledigt" && x.due_at && new Date(x.due_at) < new Date()).length,
  };

  const assignments = (myAssignments ?? []) as any[];
  const shiftsUpcoming = assignments
    .map((a) => a.shifts)
    .filter(Boolean)
    .filter((s: any) => s.date && new Date(s.date) >= new Date())
    .slice(0, 5);

  const displayName = (me as any)?.full_name || (locale === "de" ? "Du" : "You");

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("nav.my_stats", locale)}</h1>
        <Link className="text-sm text-blue-600 hover:underline" href={`/${orgSlug}/dashboard`}>
          {t("common.back", locale)}
        </Link>
      </div>

      {engagementEnabled ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <p className="text-sm text-gray-600 dark:text-gray-400">{displayName}</p>
          <div className="mt-2 flex items-baseline gap-3">
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{score}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t("dashboard.engagement", locale)}</div>
          </div>
          {rank != null && totalRanked > 0 ? (
            <p className="mt-2 text-sm font-medium text-gray-800 dark:text-gray-200">
              {t("me.rank_label", locale)}: {rank}{" "}
              <span className="font-normal text-gray-500 dark:text-gray-400">
                ({t("me.rank_of", locale).replace("{total}", String(totalRanked))})
              </span>
            </p>
          ) : null}
          {updatedAt ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {(locale === "de" ? "Aktualisiert" : "Updated")}: {updatedAt}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("me.engagement_disabled", locale)}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <p className="text-xs text-gray-500 dark:text-gray-400">30d</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{counts.shift_done_30d}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("dashboard.shifts", locale)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <p className="text-xs text-gray-500 dark:text-gray-400">30d</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{counts.task_done_30d}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("dashboard.tasks", locale)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <p className="text-xs text-gray-500 dark:text-gray-400">30d</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{counts.materials_30d}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("dashboard.resources", locale)}</p>
        </div>
      </div>

      {(() => {
        const bars = [
          { label: t("dashboard.shifts", locale), value: counts.shift_done_30d, color: "bg-blue-500" },
          { label: t("dashboard.tasks", locale), value: counts.task_done_30d, color: "bg-emerald-500" },
          { label: t("dashboard.resources", locale), value: counts.materials_30d, color: "bg-amber-500" }
        ];
        const max = Math.max(1, ...bars.map((b) => b.value));
        return (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("me.stats_activity_chart", locale)}</h2>
            <ul className="mt-4 space-y-3">
              {bars.map((b) => (
                <li key={b.label}>
                  <div className="mb-0.5 flex justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>{b.label}</span>
                    <span className="tabular-nums font-medium text-gray-900 dark:text-gray-100">{b.value}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full ${b.color}`}
                      style={{ width: `${Math.round((b.value / max) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("tasks.my_tasks", locale)}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{taskStats.open}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">{t("tasks.status_open", locale)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{taskStats.in_progress}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">{t("tasks.status_in_progress", locale)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{taskStats.done}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">{t("tasks.status_done", locale)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{taskStats.overdue}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">{t("dashboard.overdue", locale)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("shifts.my_shifts", locale)}</h2>
        {shiftsUpcoming.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("empty.shifts", locale)}</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {shiftsUpcoming.map((s: any, idx: number) => (
              <li key={`${s.date}-${idx}`} className="py-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.event_name || t("dashboard.shifts", locale)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {s.date ? formatCalendarDateYmd(String(s.date), locale) : "–"} ·{" "}
                  {formatShiftClockRange(s.start_time ?? null, s.end_time ?? null, locale)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

