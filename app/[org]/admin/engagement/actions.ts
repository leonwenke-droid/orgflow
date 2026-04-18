"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentOrganization } from "../../../../lib/getOrganization";
import { assertCanChangeOrgSettings } from "../../../../lib/permissionsServer";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export async function updateEngagementWeightsAction(
  orgSlug: string,
  weights: Record<string, number>
): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  if (!(await assertCanChangeOrgSettings(orgSlug, org))) {
    return { error: "Not authorized." };
  }

  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    next[k] = n;
  }

  const service = createSupabaseServiceRoleClient();
  const prev = (org.settings as Record<string, unknown>) ?? {};
  const prevWeights = (prev.engagement_weights as Record<string, unknown> | undefined) ?? {};
  const merged = { ...prevWeights, ...next };

  const { error } = await service
    .from("organizations")
    .update({ settings: { ...(org.settings as object), engagement_weights: merged } })
    .eq("id", org.id);

  if (error) return { error: error.message };
  revalidateTag("organizations");
  revalidatePath(`/${orgSlug}/admin/engagement`);
  revalidatePath(`/${orgSlug}/me`);
  revalidatePath(`/${orgSlug}/dashboard`);
  return {};
}

