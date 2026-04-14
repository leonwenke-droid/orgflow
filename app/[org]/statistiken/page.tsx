import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getRequestLocale } from "../../../lib/localeServer";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { redirectViewerToOrgOverview } from "../../../lib/viewerRouteGuard";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { t } from "../../../lib/i18n";
import { nextEngagementMilestone } from "../../../lib/formatDate";
import { getEngagementBreakdown, getOrgScoreboard, getRecentEngagementEvents } from "../../../lib/engagement/getScore";
import EngagementScoreWidget from "../../../components/engagement/EngagementScoreWidget";
import { isEngagementEnabledFromOrgRow } from "../../../lib/engagement/isEngagementEnabled";

export const dynamic = "force-dynamic";

export default async function StatisticsPage(props: { params: Promise<{ org: string }> | { org: string } }) {
  const params =
    typeof (props.params as Promise<{ org: string }>).then === "function"
      ? await (props.params as Promise<{ org: string }>)
      : (props.params as { org: string });
  const orgSlug = params.org;

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  const locale = await getRequestLocale();

  const authSupabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await authSupabase.auth.getUser();
  if (!user) redirect(`/${orgSlug}/login?redirectTo=/${encodeURIComponent(orgSlug)}/statistiken`);

  const service = createSupabaseServiceRoleClient();

  const { data: mePrimary } = await service
    .from("profiles")
    .select("id, full_name, role")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();

  const { data: meFallback } =
    !mePrimary && orgIdForData !== org.id
      ? await service
          .from("profiles")
          .select("id, full_name, role")
          .eq("auth_user_id", user.id)
          .eq("organization_id", org.id)
          .maybeSingle()
      : { data: null };

  const me = (mePrimary ?? meFallback) as any;
  const effectiveOrgIdForData = mePrimary ? orgIdForData : org.id;
  const myProfileId = me?.id as string | undefined;
  redirectViewerToOrgOverview(orgSlug, me?.role ?? null);
  if (!myProfileId) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="card p-6">
          <h1 className="page-title">{t("common.access_denied", locale)}</h1>
          <p className="page-sub">{t("dashboard.use_invited_account", locale)}</p>
        </div>
      </div>
    );
  }

  const engagementEnabled = isEngagementEnabledFromOrgRow(org as any);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  const [{ data: scoreRow }, { data: myEvents }, { data: myTasks }] = await Promise.all([
    engagementEnabled
      ? service
          .from("engagement_scores")
          .select("score")
          .eq("user_id", myProfileId)
          .eq("organization_id", effectiveOrgIdForData)
          .maybeSingle()
      : Promise.resolve({ data: null as { score?: number } | null }),
    service
      .from("engagement_events")
      .select("event_type, created_at")
      .eq("user_id", myProfileId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200),
    service
      .from("tasks")
      .select("id, status, due_at")
      .eq("organization_id", effectiveOrgIdForData)
      .eq("owner_id", myProfileId)
  ]);

  const rawScore = Number((scoreRow as any)?.score ?? 0) || 0;
  const score = Math.max(0, rawScore);
  const next = nextEngagementMilestone(score);
  const progressPct = next > 0 ? Math.max(0, Math.min(100, Math.round((score / next) * 100))) : 0;

  const events = (myEvents ?? []) as any[];
  const shifts30d = events.filter((e) => e.event_type === "shift_done").length;
  const tasks30d = events.filter((e) => e.event_type === "task_done").length;
  const resources30d = events.filter((e) => ["material_small", "material_medium", "material_large"].includes(e.event_type)).length;

  const tasks = (myTasks ?? []) as any[];
  const taskStats = {
    open: tasks.filter((x) => x.status === "offen").length,
    in_progress: tasks.filter((x) => x.status === "in_arbeit").length,
    done: tasks.filter((x) => x.status === "erledigt").length,
    overdue: tasks.filter((x) => x.status !== "erledigt" && x.due_at && new Date(x.due_at) < new Date()).length
  };

  const displayName = (me as any)?.full_name || (locale === "de" ? "Du" : "You");

  const [breakdownWidget, recentEvWidget, orgBoardWidget] = engagementEnabled
    ? await Promise.all([
        getEngagementBreakdown(service, myProfileId, effectiveOrgIdForData),
        getRecentEngagementEvents(service, myProfileId, effectiveOrgIdForData, 24),
        getOrgScoreboard(service, effectiveOrgIdForData)
      ])
    : [null, null, null];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="page-title">{locale === "en" ? "Statistics" : "Statistiken"}</h1>
        <p className="page-sub">{org.name}</p>
      </header>

      {engagementEnabled && breakdownWidget && recentEvWidget && orgBoardWidget ? (
        <section className="card">
          <div className="p-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-text-primary">{displayName}</div>
              <EngagementScoreWidget
                totalScore={score}
                breakdown={breakdownWidget}
                recentEvents={recentEvWidget}
                orgScoreboard={orgBoardWidget}
                profileId={myProfileId}
                displayName={displayName}
              />
              <div className="mt-2 text-xs text-text-secondary">
                {locale === "en"
                  ? `${Number(score) || 0} / ${next} pts. until next milestone`
                  : `${Number(score) || 0} / ${next} Pkt. bis nächster Meilenstein`}
              </div>
              <div className="mt-2 h-2 w-full max-w-md rounded-full bg-bg-tertiary">
                <div className="h-2 rounded-full bg-brand" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="stat-card">
          <div className="section-label">{locale === "en" ? "Shifts (30d)" : "Schichten (30d)"}</div>
          <div className="text-2xl font-semibold text-text-primary dark:text-foreground-dark">{shifts30d}</div>
        </div>
        <div className="stat-card">
          <div className="section-label">{locale === "en" ? "Tasks (30d)" : "Aufgaben (30d)"}</div>
          <div className="text-2xl font-semibold text-text-primary dark:text-foreground-dark">{tasks30d}</div>
        </div>
        <div className="stat-card">
          <div className="section-label">{locale === "en" ? "Resources" : "Ressourcen"}</div>
          <div className="text-2xl font-semibold text-text-primary dark:text-foreground-dark">{resources30d}</div>
        </div>
      </section>

      <section className="card">
        <div className="p-4">
          <div className="section-label">{locale === "en" ? "Tasks overview" : "Aufgaben-Übersicht"}</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="stat-card">
              <div className="section-label">{t("tasks.status_open", locale)}</div>
              <div className="text-2xl font-semibold text-text-primary dark:text-foreground-dark">{taskStats.open}</div>
            </div>
            <div className="stat-card">
              <div className="section-label">{t("tasks.status_in_progress", locale)}</div>
              <div className="text-2xl font-semibold text-warning-dark">{taskStats.in_progress}</div>
            </div>
            <div className="stat-card">
              <div className="section-label">{t("tasks.status_done", locale)}</div>
              <div className="text-2xl font-semibold text-success-dark">{taskStats.done}</div>
            </div>
            <div className="stat-card">
              <div className="section-label">{t("dashboard.overdue", locale)}</div>
              <div className="text-2xl font-semibold text-danger-dark">{taskStats.overdue}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

