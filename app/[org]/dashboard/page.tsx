import { unstable_noStore } from "next/cache";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { removePastShifts } from "../../../lib/cleanupShifts";
import { getDashboardDisplayNames } from "../../../lib/displayName";
import { formatWeekRangeLabel, formatDateTimeForDisplay, getTodayDateString } from "../../../lib/dateFormat";
import ShiftPlanWeekNav from "../../../components/ShiftPlanWeekNav";
import type { WeekData } from "../../../components/ShiftPlanWeekView";
import { getCurrentOrganization, getCurrentUserOrganization, isSuperAdmin } from "../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";

export const dynamic = "force-dynamic";

type DashboardStats = {
  total_open: number;
  total_in_progress: number;
  total_completed: number;
  total_overdue: number;
};

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
    tasksRes,
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
      .select("id, status, due_at")
      .eq("organization_id", organizationId),
    supabase
      .from("shifts")
      .select(
        "id, event_name, date, start_time, end_time, location, notes, shift_assignments ( id, status, user_id, replacement_user_id )"
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
  const tasks = tasksRes.data ?? [];
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

  const aggregate: DashboardStats = (tasks ?? []).reduce(
    (acc: DashboardStats, t: { status: string | null; due_at: string | null }) => {
      const status = t.status as string | null;
      const dueAt = t.due_at ? new Date(t.due_at) : null;
      if (status === "offen") acc.total_open += 1;
      else if (status === "in_arbeit") acc.total_in_progress += 1;
      else if (status === "erledigt") acc.total_completed += 1;
      if (status !== "erledigt" && dueAt && dueAt < new Date()) {
        acc.total_overdue += 1;
      }
      return acc;
    },
    {
      total_open: 0,
      total_in_progress: 0,
      total_completed: 0,
      total_overdue: 0
    }
  );

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
    aggregate,
    activity,
    shifts: shifts ?? [],
    profileNames,
    committees: (committees ?? []) as { id: string; name: string }[]
  };
}

export default async function OrgDashboardPage({
  params
}: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const orgSlug = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  const org = await getCurrentOrganization(orgSlug);

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Daten immer mit Service-Role laden (umgeht RLS-Rekursion), falls Key gesetzt
  const supabaseForData = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceRoleClient()
    : undefined;
  const { treasury, aggregate, activity, shifts, profileNames, committees } =
    await getData(org.id, supabaseForData);

  // Eingeloggt mit anderer Org: zu deren Dashboard weiterleiten. Ohne Login oder ohne Org: Dashboard öffentlich anzeigen.
  if (user) {
    const userOrg = await getCurrentUserOrganization();
    const isSuper = await isSuperAdmin();
    const canAccess = isSuper || (userOrg?.id === org.id);
    if (!canAccess && userOrg) redirect(`/${userOrg.slug}/dashboard`);
  }
  const livechartCommittees = committees.filter(
    (c) => !/Jahrgangssprecher/i.test(c.name)
  );

  return (
    <div className="space-y-8">
      <header className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-cyan-200 tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-cyan-400/90">
          {org.school_short && `${org.school_short} · `}
          Overview of treasury, tasks and shifts
        </p>
        {!user && (
          <p className="pt-2">
            <a
              href={`/${orgSlug}/login`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/25 hover:text-cyan-100"
            >
              Sign in
            </a>
          </p>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-cyan-500/25 bg-card/50 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/15 text-emerald-400">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-xs font-medium text-cyan-400/90">
                  Treasury balance
                </h3>
                <p className="text-xl font-bold text-cyan-100">
                  {treasury ? treasury.amount.toLocaleString("de-DE") : "–"} €
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-cyan-400/70 border-t border-cyan-500/15 pt-2">
                {treasury
                ? `Updated ${formatDateTimeForDisplay(treasury.created_at)}`
                : "No entries yet"}
            </p>
          </div>

        <div className="rounded-xl border border-cyan-500/25 bg-card/50 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cyan-500/15 text-cyan-400">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <h3 className="text-xs font-medium text-cyan-400/90">
                Team activity
              </h3>
            </div>
            <ul className="space-y-2 text-xs">
              <li className="flex justify-between items-center">
                <span className="text-cyan-300/90">Shifts completed</span>
                <span className="font-semibold tabular-nums text-cyan-200">
                  {activity.shifts_done_30d}
                </span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-cyan-300/90">Tasks completed</span>
                <span className="font-semibold tabular-nums text-cyan-200">
                  {activity.tasks_done_30d}
                </span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-cyan-300/90">
                  Event & resource management
                </span>
                <span className="font-semibold tabular-nums text-cyan-200">
                  {activity.materials_30d}
                </span>
              </li>
              {activity.materials_30d > 0 && (
                <li className="flex justify-between items-center pl-3 text-cyan-400/70">
                  <span>Small · Medium · Large</span>
                  <span className="tabular-nums">
                    {activity.materials_small_30d} / {activity.materials_medium_30d}{" "}
                    / {activity.materials_large_30d}
                  </span>
                </li>
              )}
              <li className="flex justify-between items-center border-t border-cyan-500/15 pt-2 mt-2">
                <span className="text-cyan-300/90 font-medium">
                  Active participants
                </span>
                <span className="font-semibold tabular-nums text-cyan-200">
                  {activity.active_participants_30d} / {activity.total_members}
                </span>
              </li>
            </ul>
          </div>

        <div className="rounded-xl border border-cyan-500/25 bg-card/50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cyan-500/15 text-cyan-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                ><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            </div>
            <h3 className="text-xs font-medium text-cyan-400/90">Open tasks</h3>
          </div>
          <div className="text-2xl font-bold text-cyan-100">
            {aggregate.total_open}
          </div>
          <p className="mt-1 text-xs text-cyan-400/70">
            {aggregate.total_in_progress} in progress · {aggregate.total_overdue} overdue
          </p>
        </div>

        <div className="rounded-xl border border-cyan-500/25 bg-card/50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/15 text-blue-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                ><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <h3 className="text-xs font-medium text-cyan-400/90">Upcoming shifts</h3>
          </div>
          <div className="text-2xl font-bold text-cyan-100">
            {shifts.filter((s: { date: string }) => new Date(s.date) >= new Date()).length}
          </div>
          <p className="mt-1 text-xs text-cyan-400/70">
            {shifts.length} total
          </p>
        </div>
      </section>

      {false && (
        <section className="mb-2">
          <h2 className="mb-2 text-sm font-semibold text-cyan-400">
            Livecharts per team
          </h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7">
            {livechartCommittees.map((c) => (
              <div
                key={c.id}
                className="h-16 min-w-0 rounded border border-cyan-500/20 bg-card/40 flex flex-col items-center justify-center px-1.5 py-1 text-center"
              >
                <span
                  className="truncate w-full text-[10px] font-semibold text-cyan-400"
                  title={c.name}
                >
                  {c.name}
                </span>
                <span className="text-[9px] text-cyan-400/50">Chart</span>
              </div>
            ))}
            {livechartCommittees.length === 0 && (
              <p className="col-span-full py-2 text-xs text-cyan-400/70">
                No teams created yet.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-500/80">
            Shift plan
          </h2>
          <p className="mt-1 text-xs text-cyan-400/80">
            Use ← / → to switch weeks · Tap day card for details
          </p>
        </div>
        <div className="rounded-xl border border-cyan-500/25 bg-card/50 p-5">
          {!shifts || shifts.length === 0 ? (
            <p className="text-cyan-400/70 text-xs">
              No shifts in the system yet.
            </p>
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
                        shift_assignments?: {
                          id: string;
                          status: string;
                          user_id?: string | null;
                          replacement_user_id?: string | null;
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
                            replacement_user_id: a.replacement_user_id ?? null
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
                />
              );
            })()
          )}
        </div>
      </section>
    </div>
  );
}
