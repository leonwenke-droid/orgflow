import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getRequestLocale } from "../../../lib/localeServer";
import {
  getCurrentOrganization,
  getOrgIdForData,
  getEffectiveUserRoleForOrg,
  resolveMemberProfileForOrganization,
  isSuperAdmin
} from "../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { canViewFinance } from "../../../lib/permissions";
import { DEFAULT_CURRENCY, formatCurrency } from "../../../lib/currency";
import { formatShiftSlot, type AppLocale } from "../../../lib/formatDate";
import { t } from "../../../lib/i18n";
import { taskRowBorderClass } from "../../../lib/taskStatus";

export const dynamic = "force-dynamic";

function dateOnly(value: string | null | undefined) {
  return String(value ?? "").slice(0, 10);
}

export default async function OrgOverviewPage(props: { params: Promise<{ org: string }> | { org: string } }) {
  const params =
    typeof (props.params as Promise<{ org: string }>).then === "function"
      ? await (props.params as Promise<{ org: string }>)
      : (props.params as { org: string });

  const orgSlug = params.org;
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const locale = await getRequestLocale();

  const auth = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await auth.auth.getUser();
  if (!user) redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/overview`);

  const superUser = await isSuperAdmin();
  const memberProf = superUser ? null : await resolveMemberProfileForOrganization(user.id, orgSlug, org);
  const myProfileId = memberProf?.id ?? null;
  if (!superUser && !myProfileId) {
    redirect(`/${orgSlug}/dashboard`);
  }

  const role = await getEffectiveUserRoleForOrg(orgSlug, org);
  const showBalance = canViewFinance(role);

  const service = createSupabaseServiceRoleClient();
  const todayStr = new Date().toISOString().slice(0, 10);
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);

  const currencyCode = (org.settings?.currency as string | undefined) ?? DEFAULT_CURRENCY;
  const localeForMoney = locale === "de" ? "de-DE" : "en-GB";

  const [
    { count: membersCount },
    { count: openTasksCount },
    { data: shifts7d },
    { data: latestTreasury },
    { data: myNextTask },
    { data: activityRows }
  ] = await Promise.all([
    service.from("profiles").select("id", { count: "exact", head: true }).eq("organization_id", orgIdForData),
    service
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgIdForData)
      .neq("status", "erledigt"),
    service
      .from("shifts")
      .select("id, event_name, date, start_time, end_time, required_slots, shift_assignments(id)")
      .eq("organization_id", orgIdForData)
      .gte("date", todayStr)
      .lte("date", in7Str)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(50),
    showBalance
      ? service
          .from("treasury_updates")
          .select("amount, created_at")
          .eq("organization_id", orgIdForData)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
    myProfileId
      ? service
          .from("tasks")
          .select("id, title, status, due_at")
          .eq("organization_id", orgIdForData)
          .eq("owner_id", myProfileId)
          .neq("status", "erledigt")
          .order("due_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
    service
      .from("engagement_events")
      .select("id, user_id, event_type, created_at")
      .eq("organization_id", orgIdForData)
      .order("created_at", { ascending: false })
      .limit(5)
  ]);

  const shifts = (shifts7d ?? []) as Array<{
    id: string;
    event_name: string | null;
    date: string | null;
    start_time: string | null;
    end_time: string | null;
    required_slots: number | null;
    shift_assignments: { id: string }[] | null;
  }>;

  const shiftSlots7d = shifts.reduce((sum, s) => sum + (Number(s.required_slots ?? 0) || 0), 0);

  const activityUserIds = [...new Set((activityRows ?? []).map((r: any) => String(r.user_id ?? "")).filter(Boolean))];
  const { data: activityProfiles } =
    activityUserIds.length > 0
      ? await service.from("profiles").select("id, full_name").in("id", activityUserIds)
      : { data: [] };
  const nameById = new Map((activityProfiles ?? []).map((p: any) => [p.id, p.full_name ?? "—"]));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="page-title">{locale === "en" ? "Overview" : "Gesamtübersicht"}</h1>
        <p className="page-sub">{org.name}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="stat-card">
          <div className="section-label">{t("dashboard.members", locale)}</div>
          <div className="text-2xl font-semibold text-gray-900">{membersCount ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="section-label">{locale === "en" ? "Open tasks" : "Offene Aufgaben"}</div>
          <div className="text-2xl font-semibold text-warning-dark">{openTasksCount ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="section-label">{locale === "en" ? "Shift slots (7d)" : "Schicht-Slots 7d"}</div>
          <div className="text-2xl font-semibold text-gray-900">{shiftSlots7d}</div>
        </div>
        <div className="stat-card">
          <div className="section-label">{locale === "en" ? "Balance" : "Kontostand"}</div>
          <div className="text-2xl font-semibold text-gray-900">
            {showBalance && latestTreasury
              ? formatCurrency(Number((latestTreasury as any).amount ?? 0), localeForMoney, currencyCode)
              : "—"}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="card">
            <div className="p-4">
              <div className="section-label">{locale === "en" ? "My next task" : "Meine nächste Aufgabe"}</div>
              {myNextTask ? (
                <div className={`border-l pl-3 ${taskRowBorderClass((myNextTask as any).status, (myNextTask as any).due_at)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900">{(myNextTask as any).title ?? "—"}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {(myNextTask as any).due_at ? `${locale === "en" ? "Due" : "Fällig"} ${dateOnly((myNextTask as any).due_at)}` : "—"}
                      </div>
                    </div>
                    <Link href={`/${orgSlug}/tasks`} className="btn-secondary">
                      {t("common.view", locale)}
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">—</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="p-4">
              <div className="section-label">{locale === "en" ? "Last activity" : "Letzte Aktivität"}</div>
              {(activityRows ?? []).length === 0 ? (
                <div className="text-sm text-gray-500">—</div>
              ) : (
                <ul className="space-y-2">
                  {(activityRows ?? []).slice(0, 5).map((row: any) => {
                    const who = nameById.get(String(row.user_id ?? "")) ?? "—";
                    return (
                      <li key={row.id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light text-xs font-semibold text-brand-dark">
                          {who
                            .split(/\s+/)
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((p: string) => p[0]?.toUpperCase())
                            .join("") || "—"}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm text-gray-900">{who}</div>
                          <div className="truncate text-xs text-gray-500">
                            {String(row.event_type ?? "").replace(/_/g, " ")} · {dateOnly(String(row.created_at ?? ""))}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="p-4">
            <div className="section-label">{locale === "en" ? "Shift utilization" : "Schicht-Auslastung"}</div>
            {shifts.length === 0 ? (
              <div className="text-sm text-gray-500">—</div>
            ) : (
              <ul className="space-y-3">
                {shifts.slice(0, 10).map((s) => {
                  const req = Math.max(1, Number(s.required_slots ?? 1) || 1);
                  const taken = (s.shift_assignments ?? []).length;
                  const pct = Math.round((taken / req) * 100);
                  return (
                    <li key={s.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900">{s.event_name ?? "—"}</div>
                          <div className="mt-1 text-xs text-gray-500">
                            {formatShiftSlot(dateOnly(s.date), s.start_time, s.end_time, locale as AppLocale)}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-gray-500">
                          {taken}/{req}
                        </div>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                        <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

