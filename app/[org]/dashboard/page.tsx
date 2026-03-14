import { unstable_noStore } from "next/cache";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { removePastShifts } from "../../../lib/cleanupShifts";
import { getDashboardDisplayNames } from "../../../lib/displayName";
import { formatWeekRangeLabel, formatDateTimeForDisplay, getTodayDateString } from "../../../lib/dateFormat";
import ShiftPlanWeekNav from "../../../components/ShiftPlanWeekNav";
import EmptyState from "../../../components/EmptyState";
import OnboardingBanner from "../../../components/OnboardingBanner";
import { CheckSquare, CalendarDays, Wallet, Users } from "lucide-react";
import type { WeekData } from "../../../components/ShiftPlanWeekView";
import { getCurrentOrganization, getCurrentUserOrganization, getOrgIdForData, isSuperAdmin } from "../../../lib/getOrganization";
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
        "id, event_name, date, start_time, end_time, location, notes, required_slots, shift_assignments ( id, status, user_id, replacement_user_id )"
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

  // Access check: dashboard is public, but only org members/super-admin should get full data via service role.
  const isSuper = user ? await isSuperAdmin() : false;
  const userOrg = user ? await getCurrentUserOrganization() : null;
  const canAccessOrgData = !!user && (isSuper || userOrg?.id === org.id);

  // Data client selection:
  // - Org member / super-admin: use service role (avoids RLS recursion) when available
  // - Otherwise: use anon client to keep behavior consistent with public dashboard and avoid cross-org redirects
  const supabaseForData: SupabaseClient | undefined = canAccessOrgData
    ? (process.env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseServiceRoleClient() : undefined)
    : (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          })
        : undefined);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const { treasury, aggregate, activity, shifts, profileNames, committees } =
    await getData(orgIdForData, supabaseForData);

  // IMPORTANT: Do not redirect to another organisation's dashboard.
  // If user is logged in but not a member of this org, keep showing the public dashboard.
  const livechartCommittees = committees.filter(
    (c) => !/Jahrgangssprecher/i.test(c.name)
  );

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-gray-600">
          {org.school_short && `${org.school_short} · `}
          Overview of treasury, tasks and shifts
        </p>
        {!user && (
          <p className="pt-2">
            <a
              href={`/${orgSlug}/login`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              Sign in
            </a>
          </p>
        )}
      </header>

      {user && <OnboardingBanner />}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            icon: CheckSquare,
            label: "Open Tasks",
            value: aggregate.total_open,
            sub: "tasks need attention"
          },
          {
            icon: CalendarDays,
            label: "Upcoming Shifts",
            value: (shifts as { date: string }[]).filter((s) => {
              const d = new Date(s.date);
              const now = new Date();
              const in7 = new Date(now);
              in7.setDate(in7.getDate() + 7);
              return d >= now && d <= in7;
            }).length,
            sub: "in the next 7 days"
          },
          {
            icon: Wallet,
            label: "Treasury",
            value: treasury ? `€${treasury.amount.toLocaleString("de-DE")}` : "–",
            sub: "current balance"
          },
          {
            icon: Users,
            label: "Members",
            value: activity.total_members,
            sub: "in this organisation"
          }
        ].map(({ icon: Icon, label, value, sub }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-card-dark"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500 dark:text-muted">{label}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-gray-800">
                <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-foreground-dark">{value}</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-muted">{sub}</p>
          </div>
        ))}
      </section>

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

      <section className="space-y-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Shift plan
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            Use ← / → to switch weeks · Tap day card for details
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          {!shifts || shifts.length === 0 ? (
            <EmptyState messageKey="empty.shifts" actionHref={`/${orgSlug}/admin/shifts`} actionLabelKey="cta.create_shift" />
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
                          required_slots: s.required_slots ?? 1,
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
                  orgSlug={orgSlug}
                  showClaimButton={canAccessOrgData}
                />
              );
            })()
          )}
        </div>
      </section>
    </div>
  );
}
