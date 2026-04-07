"use server";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData } from "../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";

const TASK_EVENTS = ["task_done", "task_late", "task_missed"];
const SHIFT_EVENTS = ["shift_done", "shift_missed"];
const MATERIAL_EVENTS = ["material_small", "material_medium", "material_large"];

export type ScoreRow = {
  id: string;
  user_id: string;
  profile: { id: string; full_name: string; auth_user_id?: string | null; committee?: { name?: string } | null };
  total_score: number;
  task_points: number;
  shift_points: number;
  material_points: number;
};

export async function getEngagementScoresAction(
  orgSlug: string
): Promise<{ error: string | null; errorKey?: string; scores?: ScoreRow[] }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData, orgSlug))) return { error: null, errorKey: "common.unauthorized" };

  const supabase = createSupabaseServiceRoleClient();

  const { data: scoresByOrg } = await supabase
    .from("engagement_scores")
    .select("user_id, score")
    .eq("organization_id", orgIdForData);

  const scoresByUser: Record<string, number> = {};
  const userIdsFromScores: string[] = [];
  for (const row of scoresByOrg ?? []) {
    const r = row as { user_id: string; score: number };
    scoresByUser[r.user_id] = r.score ?? 0;
    userIdsFromScores.push(r.user_id);
  }

  const { data: orgProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, auth_user_id, committee:committees!committee_id(name)")
    .eq("organization_id", orgIdForData)
    .order("full_name");

  const orgProfileIds = new Set((orgProfiles ?? []).map((p: { id: string }) => p.id));
  const missingProfileIds = userIdsFromScores.filter((id) => !orgProfileIds.has(id));

  let extraProfiles: Array<{ id: string; full_name: string | null; auth_user_id?: string | null; committee: unknown }> = [];
  if (missingProfileIds.length > 0) {
    const { data: extra } = await supabase
      .from("profiles")
      .select("id, full_name, auth_user_id, committee:committees!committee_id(name)")
      .in("id", missingProfileIds);
    extraProfiles = (extra ?? []) as Array<{ id: string; full_name: string | null; auth_user_id?: string | null; committee: unknown }>;
  }

  const combinedProfiles = [...(orgProfiles ?? []), ...extraProfiles];
  const allIds = combinedProfiles.map((p: { id: string }) => p.id);

  const missingScores = allIds.filter((id) => scoresByUser[id] === undefined);
  if (missingScores.length > 0) {
    const { data: byUser } = await supabase
      .from("engagement_scores")
      .select("user_id, score")
      .in("user_id", missingScores);
    for (const row of byUser ?? []) {
      const r = row as { user_id: string; score: number };
      scoresByUser[r.user_id] = r.score ?? 0;
    }
  }

  let eventsByUser: Record<string, { task_points: number; shift_points: number; material_points: number }> = {};
  if (allIds.length > 0) {
    const { data: events } = await supabase
      .from("engagement_events")
      .select("user_id, event_type, points")
      .in("user_id", allIds);
    const list = (events ?? []) as { user_id: string; event_type: string; points: number }[];
    for (const e of list) {
      if (!eventsByUser[e.user_id]) eventsByUser[e.user_id] = { task_points: 0, shift_points: 0, material_points: 0 };
      if (TASK_EVENTS.includes(e.event_type)) eventsByUser[e.user_id].task_points += e.points ?? 0;
      else if (SHIFT_EVENTS.includes(e.event_type)) eventsByUser[e.user_id].shift_points += e.points ?? 0;
      else if (MATERIAL_EVENTS.includes(e.event_type)) eventsByUser[e.user_id].material_points += e.points ?? 0;
    }
  }

  const scores: ScoreRow[] = combinedProfiles
    .map((p: any) => ({
      id: p.id,
      user_id: p.id,
      profile: { id: p.id, full_name: p.full_name ?? "–", auth_user_id: p.auth_user_id ?? null, committee: p.committee },
      total_score: scoresByUser[p.id] ?? 0,
      task_points: eventsByUser[p.id]?.task_points ?? 0,
      shift_points: eventsByUser[p.id]?.shift_points ?? 0,
      material_points: eventsByUser[p.id]?.material_points ?? 0
    }))
    .sort((a, b) => b.total_score - a.total_score);

  return { error: null, scores };
}

export type EngagementLogRow = {
  id: string;
  kind: "manual" | "event";
  created_at: string;
  points: number;
  event_type?: string | null;
  reason?: string | null;
};

/** Admin-only: engagement_events + score_import_log for one profile in the org. */
export async function getEngagementLogForProfileAction(
  orgSlug: string,
  profileId: string
): Promise<{ errorKey?: string; entries?: EngagementLogRow[] }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData, orgSlug))) return { errorKey: "common.unauthorized" };

  const supabase = createSupabaseServiceRoleClient();
  const { data: prof } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("id", profileId)
    .maybeSingle();
  const p = prof as { id: string; organization_id: string } | null;
  if (!p || p.organization_id !== orgIdForData) {
    return { errorKey: "common.unauthorized" };
  }

  const [{ data: evs }, { data: logs }] = await Promise.all([
    supabase
      .from("engagement_events")
      .select("id, event_type, points, created_at")
      .eq("user_id", profileId)
      .neq("event_type", "score_import")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("score_import_log")
      .select("id, points, reason, created_at")
      .eq("organization_id", orgIdForData)
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(50)
  ]);

  const eventRows: EngagementLogRow[] = (evs ?? []).map((e: { id: string; event_type?: string; points?: number; created_at?: string }) => ({
    id: `ev-${e.id}`,
    kind: "event" as const,
    created_at: e.created_at ?? new Date().toISOString(),
    points: e.points ?? 0,
    event_type: e.event_type ?? null
  }));

  const manualRows: EngagementLogRow[] = (logs ?? []).map(
    (e: { id: string; points?: number; reason?: string; created_at?: string }) => ({
      id: `im-${e.id}`,
      kind: "manual" as const,
      created_at: e.created_at ?? new Date().toISOString(),
      points: e.points ?? 0,
      reason: e.reason ?? null
    })
  );

  const entries = [...eventRows, ...manualRows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return { entries };
}
