import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getRequestLocale } from "../../../../lib/localeServer";
import { cookies } from "next/headers";
import Link from "next/link";
import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import {
  getCurrentOrganization,
  getCurrentUserRoleInOrg,
  getOrgIdForData,
  isSuperAdmin,
  resolveMemberProfileForOrganization
} from "../../../../lib/getOrganization";
import { canAccessOperationalAdmin } from "../../../../lib/permissions";
import { t } from "../../../../lib/i18n";
import { formatShiftSlot, type AppLocale } from "../../../../lib/formatDate";
import { DEFAULT_CURRENCY, formatCurrency } from "../../../../lib/currency";
import AdminForbidden from "../AdminForbidden";

function dateOnly(value: string | null | undefined) {
  return String(value ?? "").slice(0, 10);
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

async function latestTreasuryRow(
  service: ReturnType<typeof createSupabaseServiceRoleClient>,
  orgIds: string[]
): Promise<{ amount: number; created_at: string } | null> {
  let best: { amount: number; created_at: string } | null = null;
  for (const oid of orgIds) {
    const { data } = await service
      .from("treasury_updates")
      .select("amount, created_at")
      .eq("organization_id", oid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = data as { amount: number; created_at: string } | null;
    if (row && (!best || row.created_at > best.created_at)) best = row;
  }
  return best;
}

export default async function OrgOverviewPage(props: {
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

  const locale = await getRequestLocale();
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-text-secondary dark:text-text-muted">
          {t("feedback.sign_in_hint", locale)}{" "}
          <Link href={`/${orgSlug}/login`} className="text-blue-600 underline dark:text-blue-400">
            {t("feedback.sign_in_link", locale)}
          </Link>
        </p>
      </div>
    );
  }

  const superUser = await isSuperAdmin();
  const memberProf = superUser
    ? null
    : await resolveMemberProfileForOrganization(user.id, orgSlug, org);

  if (!superUser && !memberProf) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-red-600 dark:text-red-400">{t("feedback.error_not_member", locale)}</p>
      </div>
    );
  }

  const userRole = await getCurrentUserRoleInOrg(orgIdForData, org.id);
  const operational = canAccessOperationalAdmin(userRole);
  if (!operational) {
    return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;
  }

  const service = createSupabaseServiceRoleClient();
  const start = new Date();
  const end = period === "month" ? addDays(start, 30) : addDays(start, 7);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const treasuryOrgIds = [...new Set([orgIdForData, org.id, memberProf?.organization_id].filter(Boolean))] as string[];
  const treasuryRow = await latestTreasuryRow(service, treasuryOrgIds);
  const currencyCode = (org.settings?.currency as string | undefined) ?? DEFAULT_CURRENCY;
  const localeForMoney = locale === "de" ? "de-DE" : "en-GB";

  const [{ data: tasks }, { data: shifts }, { data: events }, { data: profiles }] = await Promise.all([
    service
      .from("tasks")
      .select("id, title, status, due_at, owner_id")
      .eq("organization_id", orgIdForData)
      .is("deleted_at", null)
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

  const namesById = new Map((profiles ?? []).map((p: { id: string; full_name?: string | null }) => [p.id, p.full_name ?? "–"]));
  const unassignedTasks = (tasks ?? []).filter((x: { owner_id?: string | null }) => !x.owner_id).length;
  const assignedTasks = (tasks ?? []).length - unassignedTasks;
  const freeSlots = (shifts ?? []).reduce((sum: number, s: { required_slots?: number; shift_assignments?: unknown[] }) => {
    const req = Number(s.required_slots ?? 1) || 1;
    const taken = (s.shift_assignments ?? []).length;
    return sum + Math.max(0, req - taken);
  }, 0);

  const tasksViewHref = operational
    ? `/admin/tasks?org=${encodeURIComponent(orgSlug)}`
    : `/${orgSlug}/tasks`;
  const shiftsViewHref = operational
    ? `/admin/shifts?org=${encodeURIComponent(orgSlug)}`
    : `/${orgSlug}/shifts`;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <AdminBreadcrumb
        orgSlug={orgSlug}
        currentLabel={t("admin.card.overview_title", locale)}
        showAdminSegment={false}
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">{t("admin.card.overview_title", locale)}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {t("admin.overview_period_hint", locale)}
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Link
            href={`/${orgSlug}/admin/overview?period=week`}
            className="ui-pill text-xs"
            aria-current={period === "week" ? "page" : undefined}
          >
            {t("admin.overview_week", locale)}
          </Link>
          <Link
            href={`/${orgSlug}/admin/overview?period=month`}
            className="ui-pill text-xs"
            aria-current={period === "month" ? "page" : undefined}
          >
            {t("admin.overview_month", locale)}
          </Link>
        </div>
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="stat-card">
          <p className="text-[11px] text-text-muted">{t("admin.overview_org_balance", locale)}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">
            {treasuryRow
              ? formatCurrency(Number(treasuryRow.amount), localeForMoney, currencyCode)
              : "–"}
          </p>
          <p className="text-[11px] text-text-muted">{t("dashboard.in_this_org", locale)}</p>
        </div>
        <div className="stat-card">
          <p className="text-[11px] text-text-muted">{t("dashboard.tasks", locale)}</p>
          <p className="mt-1 text-xl font-bold text-text-primary">{tasks?.length ?? 0}</p>
          <p className="text-[11px] text-text-muted">{t("admin.overview_open_in_period", locale)}</p>
        </div>
        <div className="stat-card">
          <p className="text-[11px] text-text-muted">{t("admin.overview_assigned", locale)}</p>
          <p className="mt-1 text-xl font-bold text-text-primary">{assignedTasks}</p>
        </div>
        <div className="stat-card">
          <p className="text-[11px] text-text-muted">{t("dashboard.shifts", locale)}</p>
          <p className="mt-1 text-xl font-bold text-text-primary">{shifts?.length ?? 0}</p>
          <p className="text-[11px] text-text-muted">
            {t("admin.overview_free_slots", locale)}: {freeSlots}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-[11px] text-text-muted">{t("events.title", locale)}</p>
          <p className="mt-1 text-xl font-bold text-text-primary">{events?.length ?? 0}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">{t("dashboard.tasks", locale)}</h2>
            <Link href={tasksViewHref} className="text-xs">
              {t("common.view", locale)}
            </Link>
          </div>
          <ul className="space-y-2">
            {(tasks ?? []).slice(0, 8).map((task: { id: string; title: string; due_at?: string | null; owner_id?: string | null }) => (
              <li key={task.id} className="rounded-[var(--radius-input)] border border-border-subtle bg-bg-secondary p-2 text-xs dark:border-border-subtle dark:bg-bg-primary/50">
                <p className="truncate font-medium text-text-primary">{task.title}</p>
                <p className="text-text-muted">
                  {task.due_at ? `${dateOnly(task.due_at)} · ` : ""}
                  {task.owner_id ? namesById.get(task.owner_id) ?? "–" : t("admin.overview_unassigned", locale)}
                </p>
              </li>
            ))}
            {(tasks ?? []).length === 0 && <li className="text-xs text-text-muted">{t(operational ? "empty.tasks" : "empty.member.tasks", locale)}</li>}
          </ul>
        </div>

        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">{t("dashboard.shifts", locale)}</h2>
            <Link href={shiftsViewHref} className="text-xs">
              {t("common.view", locale)}
            </Link>
          </div>
          <ul className="space-y-2">
            {(shifts ?? []).slice(0, 8).map((s: { id: string; event_name?: string | null; date: string; start_time?: string | null; end_time?: string | null; required_slots?: number; shift_assignments?: { id: string }[] }) => {
              const req = Number(s.required_slots ?? 1) || 1;
              const taken = (s.shift_assignments ?? []).length;
              return (
                <li key={s.id} className="rounded-[var(--radius-input)] border border-border-subtle bg-bg-secondary p-2 text-xs dark:border-border-subtle dark:bg-bg-primary/50">
                  <p className="truncate font-medium text-text-primary">{s.event_name ?? "–"}</p>
                  <p className="text-text-muted">
                    {formatShiftSlot(dateOnly(s.date), s.start_time, s.end_time, locale as AppLocale)}
                  </p>
                  <p className="text-text-muted">
                    {taken}/{req}
                  </p>
                </li>
              );
            })}
            {(shifts ?? []).length === 0 && <li className="text-xs text-text-muted">{t(operational ? "empty.shifts" : "empty.member.shifts", locale)}</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-border-subtle bg-bg-primary p-4 shadow-sm dark:border-border-default bg-card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary dark:text-text-primary">{t("events.title", locale)}</h2>
            {operational ? (
              <Link href={`/${orgSlug}/admin/events`} className="text-xs text-blue-600 hover:underline">
                {t("common.view", locale)}
              </Link>
            ) : (
              <span className="text-xs text-text-muted dark:text-text-secondary">{t("admin.overview_events_members_hint", locale)}</span>
            )}
          </div>
          <ul className="space-y-2">
            {(events ?? []).slice(0, 8).map((e: { id: string; name: string; start_date: string; end_date: string }) => (
              <li key={e.id} className="rounded border border-border-subtle bg-bg-secondary p-2 text-xs dark:border-border-default dark:bg-bg-primary/40">
                <p className="truncate font-medium text-text-primary dark:text-text-primary">{e.name}</p>
                <p className="text-text-secondary">
                  {dateOnly(e.start_date)}
                  {dateOnly(e.end_date) && dateOnly(e.end_date) !== dateOnly(e.start_date) ? ` – ${dateOnly(e.end_date)}` : ""}
                </p>
              </li>
            ))}
            {(events ?? []).length === 0 && <li className="text-xs text-text-secondary">{t("events.empty", locale)}</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
