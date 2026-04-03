import { getRequestLocale } from "../../../lib/localeServer";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { t } from "../../../lib/i18n";
import {
  getCurrentOrganization,
  getCurrentUserRoleInOrg,
  getOrgIdForData,
  isOrgAdmin
} from "../../../lib/getOrganization";
import { canManageMembersAndTeams, canViewFinance } from "../../../lib/permissions";
import AdminBreadcrumb from "../../../components/AdminBreadcrumb";
import AdminForbidden from "./AdminForbidden";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";

export default async function AdminDashboard({
  params
}: {
  params: Promise<{ org: string }> | { org: string };
}) {
  const orgSlug = typeof (params as Promise<{ org: string }>).then === "function"
    ? (await (params as Promise<{ org: string }>)).org
    : (params as { org: string }).org;
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  if (!(await isOrgAdmin(orgIdForData))) {
    return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;
  }

  const locale = await getRequestLocale();

  const authClient = createServerComponentClient({ cookies });
  const {
    data: { session }
  } = await authClient.auth.getSession();
  const currentAuthUserId = session?.user?.id ?? null;

  const userRole = await getCurrentUserRoleInOrg(orgIdForData, org.id);
  const showFinanceCard = canViewFinance(userRole);
  const fullOrgControl = canManageMembersAndTeams(userRole);

  const service = createSupabaseServiceRoleClient();
  const todayStr = new Date().toISOString().slice(0, 10);
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);

  const [
    { count: memberCount },
    { count: openTasksCount },
    { count: overdueTasksCount },
    { count: activeMembersCount },
    { data: shifts7d },
    { data: committees },
    { count: pendingTransfersCount }
  ] = await Promise.all([
    service.from("profiles").select("id", { count: "exact", head: true }).eq("organization_id", orgIdForData),
    service
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgIdForData)
      .is("deleted_at", null)
      .neq("status", "erledigt"),
    service
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgIdForData)
      .is("deleted_at", null)
      .neq("status", "erledigt")
      .lt("due_at", new Date().toISOString()),
    service
      .from("engagement_scores")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", orgIdForData)
      .gt("score", 0),
    service
      .from("shifts")
      .select("id, committee_id, required_slots, shift_assignments(id)")
      .eq("organization_id", orgIdForData)
      .gte("date", todayStr)
      .lte("date", in7Str),
    service.from("committees").select("id, name").eq("organization_id", orgIdForData).order("name"),
    service
      .from("task_transfer_requests")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgIdForData)
      .eq("status", "pending")
  ]);

  const shiftsSlots7d = (shifts7d ?? []).reduce((sum, s: any) => sum + (Number(s.required_slots ?? 0) || 0), 0);

  const committeeUtil = (committees ?? []).map((c: any) => {
    const teamShifts = (shifts7d ?? []).filter((s: any) => s.committee_id === c.id);
    const required = teamShifts.reduce((sum: number, s: any) => sum + (Number(s.required_slots ?? 0) || 0), 0);
    const taken = teamShifts.reduce((sum: number, s: any) => sum + ((s.shift_assignments ?? []).length || 0), 0);
    const pct = required > 0 ? Math.round((taken / required) * 100) : 0;
    return { id: c.id as string, name: String(c.name ?? "—"), required, taken, pct };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <AdminBreadcrumb orgSlug={orgSlug} currentLabel={t("admin.page_title", locale)} />
        <h1 className="page-title">{t("admin.page_title", locale)}</h1>
        <p className="page-sub">{org.name}</p>
      </header>

      {typeof overdueTasksCount === "number" && overdueTasksCount > 0 ? (
        <div className="card border border-warning-light bg-warning-light/40 p-4 dark:border-amber-700 dark:bg-amber-900/20">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-warning-dark" aria-hidden>⚠</span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-warning-dark">
                {locale === "en"
                  ? `${overdueTasksCount} tasks are overdue — please assign or reschedule`
                  : `${overdueTasksCount} Aufgaben sind überfällig — bitte zuweisen oder neu planen`}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="stat-card">
          <div className="section-label">{t("dashboard.members", locale)}</div>
          <div className="text-2xl font-semibold text-text-primary dark:text-foreground-dark">{memberCount ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="section-label">{locale === "en" ? "Open tasks" : "Aufgaben offen"}</div>
          <div className="text-2xl font-semibold text-warning-dark">{openTasksCount ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="section-label">{locale === "en" ? "Shift slots (7d)" : "Schichten (7d)"}</div>
          <div className="text-2xl font-semibold text-text-primary dark:text-foreground-dark">{shiftsSlots7d}</div>
        </div>
        <div className="stat-card">
          <div className="section-label">{locale === "en" ? "Active members" : "Aktive Mitglieder"}</div>
          <div className="text-2xl font-semibold text-text-primary dark:text-foreground-dark">{activeMembersCount ?? 0}</div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="p-4">
            <div className="section-label">
              {locale === "en" ? "Team workload (7 days)" : "Team-Belastung (7 Tage)"}
            </div>
            <p className="mb-3 text-[10px] text-text-secondary">
              {locale === "en"
                ? "Filled vs. required shift slots in the next 7 days"
                : "Besetzte vs. benötigte Schicht-Slots in den nächsten 7 Tagen"}
            </p>
            {committeeUtil.length === 0 ? (
              <p className="text-sm text-text-secondary">—</p>
            ) : (
              <ul className="space-y-3">
                {committeeUtil.map((c) => {
                  const barColor = c.pct >= 75 ? "bg-green-500" : c.pct >= 25 ? "bg-amber-500" : "bg-red-500";
                  return (
                    <li key={c.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 text-sm font-medium text-text-primary dark:text-text-primary">{c.name}</div>
                        <div className="shrink-0 text-xs text-text-secondary">
                          {c.taken}/{c.required} ({c.pct}%)
                        </div>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-bg-tertiary dark:bg-bg-tertiary">
                        <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.max(0, Math.min(100, c.pct))}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="card">
          <div className="p-4">
            <div className="section-label">{locale === "en" ? "Quick actions" : "Schnellaktionen"}</div>
            <div className="space-y-2">
              <Link href={`/admin/shifts?org=${encodeURIComponent(orgSlug)}`} className="btn-primary inline-flex w-full items-center justify-center gap-2">
                {locale === "en" ? "New shift" : "Neue Schicht anlegen"}
              </Link>
              <Link href={`/admin/tasks?org=${encodeURIComponent(orgSlug)}`} className="btn-secondary inline-flex w-full items-center justify-center gap-2">
                {locale === "en" ? "New task" : "Neue Aufgabe erstellen"}
              </Link>
              {fullOrgControl ? (
                <>
                  <Link href={`/${orgSlug}/admin/members`} className="btn-secondary inline-flex w-full items-center justify-center gap-2">
                    {locale === "en" ? "Invite member" : "Mitglied einladen"}
                  </Link>
                  <Link href={`/${orgSlug}/admin/committees`} className="btn-secondary inline-flex w-full items-center justify-center gap-2">
                    {locale === "en" ? "New team" : "Neues Team anlegen"}
                  </Link>
                </>
              ) : null}
              <Link href={`/${orgSlug}/admin/transfers`} className="btn-secondary inline-flex w-full items-center justify-center gap-2">
                {locale === "en" ? "Pending transfers" : "Offene Übergaben"}
                {(pendingTransfersCount ?? 0) > 0 ? (
                  <span className="tag tag-amber ml-1">{pendingTransfersCount}</span>
                ) : null}
              </Link>
              {showFinanceCard ? (
                <Link href={`/${orgSlug}/admin/finanzen`} className="btn-secondary inline-flex w-full items-center justify-center">
                  {locale === "en" ? "Finance" : "Finanzen"}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
