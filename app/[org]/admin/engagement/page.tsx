import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import AdminBreadcrumb from "../../../../components/AdminBreadcrumb";
import AdminForbidden from "../AdminForbidden";
import { getRequestLocale } from "../../../../lib/localeServer";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin } from "../../../../lib/getOrganization";
import { canAccessOperationalAdmin } from "../../../../lib/permissions";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

import EngagementTabs from "./EngagementTabs";

export const dynamic = "force-dynamic";

export default async function AdminEngagementPage(props: { params: Promise<{ org: string }> | { org: string } }) {
  const params =
    typeof (props.params as Promise<{ org: string }>).then === "function"
      ? await (props.params as Promise<{ org: string }>)
      : (props.params as { org: string });
  const orgSlug = params.org;

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);

  if (!(await isOrgAdmin(orgIdForData, orgSlug))) return <AdminForbidden orgSlug={orgSlug} orgName={org.name} />;

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

  const [
    { data: scoreRows },
    { data: eventRows },
    { data: profileRows },
    { data: pcRows },
    { data: committeeRows },
  ] = await Promise.all([
    service
      .from("engagement_scores")
      .select("user_id, score")
      .eq("organization_id", orgIdForData)
      .order("score", { ascending: false }),
    service
      .from("engagement_events")
      .select("id, user_id, event_type, points, created_at")
      .eq("organization_id", orgIdForData)
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    service
      .from("profiles")
      .select("id, full_name, committee_id")
      .eq("organization_id", orgIdForData),
    service
      .from("profile_committees")
      .select("user_id, committee_id"),
    service
      .from("committees")
      .select("id, name")
      .eq("organization_id", orgIdForData),
  ]);

  const scores = (scoreRows ?? []) as { user_id: string; score: number }[];
  const events = (eventRows ?? []) as { id: string; user_id: string; event_type: string; points: number | null; created_at: string }[];
  const profiles = (profileRows ?? []) as { id: string; full_name: string; committee_id: string | null }[];
  const committees = (committeeRows ?? []) as { id: string; name: string }[];
  const profileCommittees = (pcRows ?? []) as { user_id: string; committee_id: string }[];

  const committeeNameById = new Map(committees.map((c) => [c.id, c.name]));
  const nameById: Record<string, string> = Object.fromEntries(profiles.map((p) => [p.id, p.full_name ?? "—"]));

  function getTeamName(profileId: string): string | null {
    const prof = profiles.find((p) => p.id === profileId);
    if (prof?.committee_id) return committeeNameById.get(prof.committee_id) ?? null;
    const pc = profileCommittees.find((pc) => pc.user_id === profileId);
    return pc ? committeeNameById.get(pc.committee_id) ?? null : null;
  }

  const scoreMap = new Map(scores.map((s) => [s.user_id, Number(s.score) || 0]));

  const activeMembers = scores.filter((s) => (Number(s.score) || 0) > 0).length;
  const avgScore = scores.length > 0
    ? Math.round((scores.reduce((sum, s) => sum + (Number(s.score) || 0), 0) / scores.length) * 10) / 10
    : 0;
  const tasksDone30d = events.filter((e) => e.event_type === "task_done").length;
  const shiftsDone30d = events.filter((e) => e.event_type === "shift_done").length;

  const activeUserIds = new Set(events.map((e) => e.user_id));
  const inactiveMembers = profiles.filter((p) => !activeUserIds.has(p.id)).length;

  const scoresForClient = scores.map((s) => ({
    user_id: s.user_id,
    score: Number(s.score) || 0,
    name: nameById[s.user_id] ?? "—",
    team: getTeamName(s.user_id),
  }));

  const tasksDoneByUser = new Map<string, number>();
  const shiftsDoneByUser = new Map<string, number>();
  const lastActivityByUser = new Map<string, string>();

  for (const e of events) {
    if (e.event_type === "task_done") {
      tasksDoneByUser.set(e.user_id, (tasksDoneByUser.get(e.user_id) ?? 0) + 1);
    }
    if (e.event_type === "shift_done") {
      shiftsDoneByUser.set(e.user_id, (shiftsDoneByUser.get(e.user_id) ?? 0) + 1);
    }
    if (!lastActivityByUser.has(e.user_id)) {
      lastActivityByUser.set(e.user_id, e.created_at);
    }
  }

  const membersForClient = profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name ?? "—",
    team: getTeamName(p.id),
    score: scoreMap.get(p.id) ?? 0,
    tasksDone: tasksDoneByUser.get(p.id) ?? 0,
    shiftsDone: shiftsDoneByUser.get(p.id) ?? 0,
    lastActivity: lastActivityByUser.get(p.id) ?? null,
  })).sort((a, b) => b.score - a.score);

  const weights = ((org.settings as any)?.engagement_weights ?? {}) as Record<string, number>;

  const locale = await getRequestLocale();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <AdminBreadcrumb orgSlug={orgSlug} currentLabel="Engagement" />
        <h1 className="page-title">Engagement</h1>
        <p className="page-sub">{org.name}</p>
      </header>

      <EngagementTabs
        orgSlug={orgSlug}
        stats={{
          activeMembers,
          avgScore,
          tasksDone30d,
          shiftsDone30d,
          inactiveMembers,
        }}
        scores={scoresForClient}
        members={membersForClient}
        events={events}
        weights={weights}
        nameById={nameById}
      />
    </div>
  );
}
