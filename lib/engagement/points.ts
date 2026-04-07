/**
 * Canonical engagement point values (aligned with DB triggers and admin shift logic).
 * MD spec used different numbers; production values stay until product changes them.
 */

export const ENGAGEMENT_POINTS = {
  task_done: 8,
  task_late: -3,
  shift_done_base: 10,
  shift_bonus_aufbau: 5,
  shift_bonus_abbau: 5,
  shift_missed: -15
} as const;

export type EngagementCategory = "task" | "shift_auto" | "shift_rotation" | "other";

/** Map event_type to default category when shift/task context is absent. */
export function defaultCategoryForEventType(eventType: string): EngagementCategory {
  if (eventType === "task_done" || eventType === "task_late" || eventType === "task_missed") {
    return "task";
  }
  if (eventType === "shift_done" || eventType === "shift_missed" || eventType === "replacement_arranged") {
    return "shift_auto";
  }
  return "other";
}

export function categoryForAssignmentKind(assignmentKind: string | null | undefined): "shift_auto" | "shift_rotation" {
  return assignmentKind === "rotation" ? "shift_rotation" : "shift_auto";
}
