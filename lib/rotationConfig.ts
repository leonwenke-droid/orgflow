/** Matches `organizations.rotation_config` JSONB (Supabase migration rotation_scores_system). */
export type RotationConfig = {
  enabled?: boolean;
  pts_on_shift_done?: number;
  pts_on_assignment?: number;
  pts_cooldown_per_day?: number;
  allow_swap?: boolean;
  notify_on_assignment?: boolean;
};

export const DEFAULT_ROTATION_CONFIG: Required<RotationConfig> = {
  enabled: true,
  pts_on_shift_done: 10,
  pts_on_assignment: 15,
  pts_cooldown_per_day: 0.5,
  allow_swap: true,
  notify_on_assignment: false
};

export function mergeRotationConfig(raw: unknown): Required<RotationConfig> {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : DEFAULT_ROTATION_CONFIG.enabled,
    pts_on_shift_done:
      typeof o.pts_on_shift_done === "number" ? o.pts_on_shift_done : DEFAULT_ROTATION_CONFIG.pts_on_shift_done,
    pts_on_assignment:
      typeof o.pts_on_assignment === "number" ? o.pts_on_assignment : DEFAULT_ROTATION_CONFIG.pts_on_assignment,
    pts_cooldown_per_day:
      typeof o.pts_cooldown_per_day === "number"
        ? o.pts_cooldown_per_day
        : DEFAULT_ROTATION_CONFIG.pts_cooldown_per_day,
    allow_swap: typeof o.allow_swap === "boolean" ? o.allow_swap : DEFAULT_ROTATION_CONFIG.allow_swap,
    notify_on_assignment:
      typeof o.notify_on_assignment === "boolean"
        ? o.notify_on_assignment
        : DEFAULT_ROTATION_CONFIG.notify_on_assignment
  };
}
