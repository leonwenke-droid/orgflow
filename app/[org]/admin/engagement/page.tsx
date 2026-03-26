import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import AdminForbidden from "../AdminForbidden";
import { getRequestLocale } from "../../../../lib/localeServer";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin } from "../../../../lib/getOrganization";
import { canAccessOperationalAdmin } from "../../../../lib/permissions";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

import EngagementRulesClient from "./EngagementRulesClient";

export const dynamic = "force-dynamic";

export default async function AdminEngagementPage(props: { params: Promise<{ org: string }> | { org: string } }) {
  const params =
    typeof (props.params as Promise<{ org: string }>).then === "function"
      ? await (props.params as Promise<{ org: string }>)
      : (props.params as { org: string });
  const orgSlug = params.org;

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  if (!(await isOrgAdmin(orgIdForData))) return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;

  const auth = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await auth.auth.getUser();
  if (!user) redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/admin/engagement`);

  const service = createSupabaseServiceRoleClient();
  const { data: meRoleRow } = await service
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();
  const myRole = (meRoleRow as { role?: any } | null)?.role ?? null;
  if (!canAccessOperationalAdmin(myRole)) {
    return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  const [{ data: scores }, { data: events }] = await Promise.all([
    service
      .from("engagement_scores")
      .select("user_id, score, profiles(full_name)")
      .eq("organization_id", orgIdForData)
      .order("score", { ascending: false })
      .limit(50),
    service
      .from("engagement_events")
      .select("id, event_type, created_at")
      .eq("organization_id", orgIdForData)
      .gte("created_at", since)
  ]);

  const activeMembers = (scores ?? []).filter((r: any) => (Number(r.score) || 0) > 0).length;
  const avgScore =
    (scores ?? []).length > 0
      ? Math.round(((scores ?? []).reduce((sum: number, r: any) => sum + (Number(r.score) || 0), 0) / (scores ?? []).length) * 10) / 10
      : 0;
  const tasksDone30d = (events ?? []).filter((e: any) => e.event_type === "task_done").length;

  const weights = ((org.settings as any)?.engagement_weights ?? {}) as Record<string, number>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <AdminBreadcrumb orgSlug={orgSlug} currentLabel="Engagement" />
        <h1 className="page-title">Engagement</h1>
        <p className="page-sub">{org.name}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="stat-card">
          <div className="section-label">Aktive Mitglieder</div>
          <div className="text-2xl font-semibold text-gray-900">{activeMembers}</div>
        </div>
        <div className="stat-card">
          <div className="section-label">Durchschnittsscore</div>
          <div className="text-2xl font-semibold text-gray-900">{avgScore}</div>
        </div>
        <div className="stat-card">
          <div className="section-label">Aufgaben erledigt</div>
          <div className="text-2xl font-semibold text-gray-900">{tasksDone30d}</div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="p-4">
            <div className="section-label">Rangliste</div>
            <ul className="mt-2 space-y-2">
              {(scores ?? []).slice(0, 10).map((r: any, idx: number) => {
                const isTop = idx === 0;
                const score = Number(r.score) || 0;
                const name = (r.profiles as any)?.full_name ?? "—";
                const topScore = Number((scores ?? [])[0]?.score ?? 0) || 0;
                const pct = topScore > 0 ? Math.round((score / topScore) * 100) : 0;
                return (
                  <li key={`${r.user_id}-${idx}`} className={`rounded-lg px-3 py-2 ${isTop ? "bg-warning-light text-warning-dark" : "bg-gray-50"}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-6 text-xs font-medium">#{idx + 1}</div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-xs font-semibold text-gray-700">
                        {String(name)
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((p: string) => p[0]?.toUpperCase())
                          .join("") || "—"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{name}</div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-white/70">
                          <div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-medium tabular-nums">{score}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <EngagementRulesClient orgSlug={orgSlug} initialWeights={weights} />
      </section>
    </div>
  );
}

