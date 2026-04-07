import type { SupabaseClient } from "@supabase/supabase-js";
import { categoryForAssignmentKind, defaultCategoryForEventType, type EngagementCategory } from "./points";

export type AddEngagementEventParams = {
  userId: string;
  organizationId: string | null;
  eventType: string;
  points: number;
  sourceId?: string | null;
  shiftId?: string | null;
  taskId?: string | null;
  /** If set, used instead of deriving (e.g. already known). */
  category?: EngagementCategory;
};

/**
 * Single write path for engagement_events (service-role Supabase client).
 * Sets category + optional FK columns; logs errors without throwing.
 * @returns new row id, or null on failure
 */
export async function addEngagementEvent(
  service: SupabaseClient,
  params: AddEngagementEventParams
): Promise<string | null> {
  let organizationId = params.organizationId;
  let category: EngagementCategory = params.category ?? defaultCategoryForEventType(params.eventType);
  let shiftId = params.shiftId ?? null;
  let taskId = params.taskId ?? null;

  if (params.eventType.startsWith("task_")) {
    category = "task";
    if (!taskId && params.sourceId) taskId = params.sourceId;
  }

  if (
    (params.eventType === "shift_done" ||
      params.eventType === "shift_missed" ||
      params.eventType === "replacement_arranged") &&
    shiftId
  ) {
    const { data: shift } = await service
      .from("shifts")
      .select("assignment_kind, organization_id")
      .eq("id", shiftId)
      .maybeSingle();
    const row = shift as { assignment_kind?: string | null; organization_id?: string | null } | null;
    if (row) {
      category = categoryForAssignmentKind(row.assignment_kind);
      if (!organizationId && row.organization_id) organizationId = row.organization_id;
    }
  }

  if (!organizationId) {
    const { data: profile } = await service
      .from("profiles")
      .select("organization_id")
      .eq("id", params.userId)
      .maybeSingle();
    organizationId = (profile as { organization_id?: string | null } | null)?.organization_id ?? null;
  }

  const payload: Record<string, unknown> = {
    user_id: params.userId,
    event_type: params.eventType,
    points: params.points,
    source_id: params.sourceId ?? null,
    category,
    shift_id: shiftId,
    task_id: taskId,
    organization_id: organizationId
  };

  const { data, error } = await service.from("engagement_events").insert(payload).select("id").single();
  if (error) {
    console.error("[engagement] addEngagementEvent failed:", error.message, params);
    return null;
  }
  return (data as { id?: string } | null)?.id ?? null;
}
