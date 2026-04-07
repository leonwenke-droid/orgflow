import type { SupabaseClient } from "@supabase/supabase-js";

export type EngagementBreakdown = {
  total_score: number;
  task_score: number;
  shift_auto_score: number;
  shift_rotation_score: number;
  other_score: number;
  task_count: number;
  shift_auto_count: number;
  shift_rotation_count: number;
  other_count: number;
};

export type EngagementEventRow = {
  id: string;
  event_type: string;
  category: string | null;
  points: number;
  created_at: string;
  shift_id: string | null;
  task_id: string | null;
  shift_label: string | null;
  task_title: string | null;
};

const emptyBreakdown: EngagementBreakdown = {
  total_score: 0,
  task_score: 0,
  shift_auto_score: 0,
  shift_rotation_score: 0,
  other_score: 0,
  task_count: 0,
  shift_auto_count: 0,
  shift_rotation_count: 0,
  other_count: 0
};

export async function getEngagementBreakdown(
  service: SupabaseClient,
  userId: string,
  orgId: string
): Promise<EngagementBreakdown> {
  const { data, error } = await service
    .from("engagement_score_breakdown")
    .select("*")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error || !data) {
    return emptyBreakdown;
  }

  const row = data as Record<string, unknown>;
  return {
    total_score: Number(row.total_score ?? 0),
    task_score: Number(row.task_score ?? 0),
    shift_auto_score: Number(row.shift_auto_score ?? 0),
    shift_rotation_score: Number(row.shift_rotation_score ?? 0),
    other_score: Number(row.other_score ?? 0),
    task_count: Number(row.task_count ?? 0),
    shift_auto_count: Number(row.shift_auto_count ?? 0),
    shift_rotation_count: Number(row.shift_rotation_count ?? 0),
    other_count: Number(row.other_count ?? 0)
  };
}

export async function getRecentEngagementEvents(
  service: SupabaseClient,
  userId: string,
  orgId: string,
  limit = 20
): Promise<EngagementEventRow[]> {
  const { data, error } = await service
    .from("engagement_events")
    .select(
      "id, event_type, category, points, created_at, shift_id, task_id, shifts(event_name), tasks(title)"
    )
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data?.length) return [];

  return (data as any[]).map((e) => {
    const shift = e.shifts as { event_name?: string } | null;
    const task = e.tasks as { title?: string } | null;
    return {
      id: e.id as string,
      event_type: String(e.event_type ?? ""),
      category: e.category != null ? String(e.category) : null,
      points: Number(e.points ?? 0),
      created_at: String(e.created_at ?? ""),
      shift_id: e.shift_id ?? null,
      task_id: e.task_id ?? null,
      shift_label: shift?.event_name?.trim() || null,
      task_title: task?.title?.trim() || null
    };
  });
}

export type OrgScoreboardRow = {
  user_id: string;
  total_score: number;
  full_name: string | null;
};

export async function getOrgScoreboard(
  service: SupabaseClient,
  orgId: string
): Promise<OrgScoreboardRow[]> {
  const { data: scores } = await service
    .from("engagement_scores")
    .select("user_id, score")
    .eq("organization_id", orgId)
    .order("score", { ascending: false });

  if (!scores?.length) return [];

  const ids = scores.map((s: { user_id: string }) => s.user_id);
  const { data: profiles } = await service.from("profiles").select("id, full_name").in("id", ids);

  const nameById = new Map((profiles ?? []).map((p: { id: string; full_name?: string | null }) => [p.id, p.full_name ?? null]));

  return (scores as { user_id: string; score: number }[]).map((s) => ({
    user_id: s.user_id,
    total_score: Number(s.score ?? 0),
    full_name: nameById.get(s.user_id) ?? null
  }));
}
