import type { SupabaseClient } from "@supabase/supabase-js";

export function isEngagementEnabledFromOrgRow(row: {
  plan?: unknown;
  settings?: unknown;
}): boolean {
  const plan = String((row as any)?.plan ?? "free");
  const features =
    (((row as any)?.settings ?? {}) as { features?: Record<string, boolean> }).features ?? {};
  return plan !== "free" && features.engagement_tracking !== false;
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

