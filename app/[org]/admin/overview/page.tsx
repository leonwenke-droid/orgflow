import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import {
  getCurrentOrganization,
  getCurrentUserRoleInOrg,
  getOrgIdForData,
  isOrgAdmin
} from "../../../../lib/getOrganization";
import { canManageMembersAndTeams, canViewFinance } from "../../../../lib/permissions";
import AdminForbidden from "../AdminForbidden";
import { localeFromCookie, LOCALE_COOKIE_NAME, t } from "../../../../lib/i18n";
import { formatShiftSlot, type AppLocale } from "../../../../lib/formatDate";

function dateOnly(value: string | null | undefined) {
  return String(value ?? "").slice(0, 10);
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export default async function AdminOverviewPage(props: {
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
  const period = sp.period === "month" ? "month" : "week";

  const cookieStore = await cookies();
  const locale = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  if (!(await isOrgAdmin(orgIdForData))) {
    return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;
  }

  const userRole = await getCurrentUserRoleInOrg(orgIdForData, org.id);
  const showFinanceShortcuts = canViewFinance(userRole);
  const fullOrgControl = canManageMembersAndTeams(userRole);

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;
  }

  const service = createSupabaseServiceRoleClient();
  const start = new Date();
  const end = period === "month" ? addDays(start, 30) : addDays(start, 7);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const [{ data: tasks }, { data: shifts }, { data: events }, { data: profiles }] = await Promise.all([
    service
      .from("tasks")
      .select("id, title, status, due_at, owner_id")
      .eq("organization_id", orgIdForData)
      .neq("status", "erledigt")
      .gte("due_at", startStr)
      .lte("due_at", `${endStr}T23:59:59`)
      .order("due_at", { ascending: true })
      .limit(20),
    service
      .from("shifts")
      .select("id, event_name, date, start_time, end_time, required_slots, shift_assignments(id)")
      .eq("organization_id", orgIdForData)
      .gte("date", startStr)
      .lte("date", endStr)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(20),
    service
      .from("events")
      .select("id, name, start_date, end_date")
      .eq("organization_id", orgIdForData)
      .or(`start_date.gte.${startStr},end_date.gte.${startStr}`)
      .order("start_date", { ascending: true })
      .limit(20),
    service.from("profiles").select("id, full_name").eq("organization_id", orgIdForData)
  ]);

  const namesById = new Map((profiles ?? []).map((p: any) => [p.id as string, p.full_name ?? "–"]));
  const unassignedTasks = (tasks ?? []).filter((x: any) => !x.owner_id).length;
  const assignedTasks = (tasks ?? []).length - unassignedTasks;
  const freeSlots = (shifts ?? []).reduce((sum: number, s: any) => {
    const req = Number(s.required_slots ?? 1) || 1;
    const taken = (s.shift_assignments ?? []).length;
    return sum + Math.max(0, req - taken);
  }, 0);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <AdminBreadcrumb orgSlug={orgSlug} currentLabel={t("admin.card.overview_title", locale)} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t("admin.card.overview_title", locale)}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t("admin.overview_period_hint", locale)}
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Link
            href={`/${orgSlug}/admin/overview?period=week`}
            className={`rounded-full border px-3 py-1 ${period === "week" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300"}`}
          >
            {t("admin.overview_week", locale)}
          </Link>
          <Link
            href={`/${orgSlug}/admin/overview?period=month`}
            className={`rounded-full border px-3 py-1 ${period === "month" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300"}`}
          >
            {t("admin.overview_month", locale)}
          </Link>
        </div>
      </div>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("admin.overview_shortcuts_title", locale)}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("admin.overview_shortcuts_hint", locale)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/${orgSlug}/admin`}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            {t("nav.admin_hub", locale)}
          </Link>
          {fullOrgControl ? (
            <Link
              href={`/${orgSlug}/settings`}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              {t("dashboard.settings", locale)}
            </Link>
          ) : null}
          <Link
            href={`/${orgSlug}/account`}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            {t("nav.my_account", locale)}
          </Link>
          {showFinanceShortcuts ? (
            <Link
              href={`/admin/treasury?org=${encodeURIComponent(orgSlug)}`}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              {t("dashboard.finance", locale)}
            </Link>
          ) : null}
          <Link
            href={`/${orgSlug}/feedback`}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            {t("nav.feedback", locale)}
          </Link>
          {fullOrgControl ? (
            <Link
              href={`/${orgSlug}/admin/feedback`}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              {t("nav.feedback_manage", locale)}
            </Link>
          ) : null}
          <Link
            href={`/${orgSlug}/admin/events`}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            {t("events.title", locale)}
          </Link>
          <Link
            href={`/${orgSlug}/admin#admin-engagement`}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            {t("admin.overview_engagement_ranking", locale)}
          </Link>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <p className="text-[11px] text-gray-500">{t("dashboard.tasks", locale)}</p>
          <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{tasks?.length ?? 0}</p>
          <p className="text-[11px] text-gray-500">{t("admin.overview_open_in_period", locale)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <p className="text-[11px] text-gray-500">{t("admin.overview_assigned", locale)}</p>
          <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{assignedTasks}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <p className="text-[11px] text-gray-500">{t("dashboard.shifts", locale)}</p>
          <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{shifts?.length ?? 0}</p>
          <p className="text-[11px] text-gray-500">{t("admin.overview_free_slots", locale)}: {freeSlots}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <p className="text-[11px] text-gray-500">{t("events.title", locale)}</p>
          <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{events?.length ?? 0}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("dashboard.tasks", locale)}</h2>
            <Link href={`/admin/tasks?org=${encodeURIComponent(orgSlug)}`} className="text-xs text-blue-600 hover:underline">
              {t("common.view", locale)}
            </Link>
          </div>
          <ul className="space-y-2">
            {(tasks ?? []).slice(0, 8).map((task: any) => (
              <li key={task.id} className="rounded border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-700 dark:bg-gray-900/40">
                <p className="truncate font-medium text-gray-900 dark:text-gray-100">{task.title}</p>
                <p className="text-gray-500">
                  {task.due_at ? `${dateOnly(task.due_at)} · ` : ""}{task.owner_id ? namesById.get(task.owner_id) ?? "–" : t("admin.overview_unassigned", locale)}
                </p>
              </li>
            ))}
            {(tasks ?? []).length === 0 && <li className="text-xs text-gray-500">{t("empty.tasks", locale)}</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("dashboard.shifts", locale)}</h2>
            <Link href={`/admin/shifts?org=${encodeURIComponent(orgSlug)}`} className="text-xs text-blue-600 hover:underline">
              {t("common.view", locale)}
            </Link>
          </div>
          <ul className="space-y-2">
            {(shifts ?? []).slice(0, 8).map((s: any) => {
              const req = Number(s.required_slots ?? 1) || 1;
              const taken = (s.shift_assignments ?? []).length;
              return (
                <li key={s.id} className="rounded border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-700 dark:bg-gray-900/40">
                  <p className="truncate font-medium text-gray-900 dark:text-gray-100">{s.event_name ?? "–"}</p>
                  <p className="text-gray-500">
                    {formatShiftSlot(dateOnly(s.date), s.start_time, s.end_time, locale as AppLocale)}
                  </p>
                  <p className="text-gray-500">{taken}/{req}</p>
                </li>
              );
            })}
            {(shifts ?? []).length === 0 && <li className="text-xs text-gray-500">{t("empty.shifts", locale)}</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-card-dark">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("events.title", locale)}</h2>
            <Link href={`/${orgSlug}/admin/events`} className="text-xs text-blue-600 hover:underline">
              {t("common.view", locale)}
            </Link>
          </div>
          <ul className="space-y-2">
            {(events ?? []).slice(0, 8).map((e: any) => (
              <li key={e.id} className="rounded border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-700 dark:bg-gray-900/40">
                <p className="truncate font-medium text-gray-900 dark:text-gray-100">{e.name}</p>
                <p className="text-gray-500">
                  {dateOnly(e.start_date)}{dateOnly(e.end_date) && dateOnly(e.end_date) !== dateOnly(e.start_date) ? ` – ${dateOnly(e.end_date)}` : ""}
                </p>
              </li>
            ))}
            {(events ?? []).length === 0 && <li className="text-xs text-gray-500">{t("events.empty", locale)}</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}

