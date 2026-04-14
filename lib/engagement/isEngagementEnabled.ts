import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Whether engagement UI and score-based features should be active for this org.
 * Driven by Settings → Active modules → Engagement (not by billing plan), so enabling
 * the toggle actually shows the dashboard widget and related UI.
 */
export function isEngagementEnabledFromOrgRow(row: {
  plan?: unknown;
  settings?: unknown;
}): boolean {
  const features =
    (((row as any)?.settings ?? {}) as { features?: Record<string, boolean> }).features ?? {};
  return features.engagement_tracking !== false;
}

export async function fetchEngagementEnabledForOrgId(
  service: SupabaseClient,
  orgId: string
): Promise<boolean> {
  const { data } = await service
    .from("organizations")
    .select("plan, settings")
    .eq("id", orgId)
    .maybeSingle();
  return isEngagementEnabledFromOrgRow((data ?? {}) as any);
}

