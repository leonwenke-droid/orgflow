"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrganization, getOrgIdForData } from "../../../../lib/getOrganization";
import { assertCanChangeOrgSettings } from "../../../../lib/permissionsServer";
import { requireOrgAdminAction } from "../../../../lib/permissionsServer";
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
  revalidatePath(`/${orgSlug}/admin/engagement`);
  revalidatePath(`/${orgSlug}/me`);
  revalidatePath(`/${orgSlug}/dashboard`);
  return {};
}

export async function awardExtraPointsAction(
  orgSlug: string,
  userId: string,
  points: number,
  reason: string
): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const actor = await requireOrgAdminAction(orgIdForData);
  if (!actor) return { error: "Not authorized." };

  if (!Number.isFinite(points) || points === 0) return { error: "Invalid points value." };

  const service = createSupabaseServiceRoleClient();

  const { error: eventErr } = await service.from("engagement_events").insert({
    user_id: userId,
    organization_id: orgIdForData,
    event_type: "extra_points",
    points,
    metadata: { reason: reason || "Extra points" },
  });
  if (eventErr) return { error: eventErr.message };

  const { data: existing } = await service
    .from("engagement_scores")
    .select("score")
    .eq("user_id", userId)
    .eq("organization_id", orgIdForData)
    .maybeSingle();

  const current = (existing as { score?: number } | null)?.score ?? 0;
  const { error: scoreErr } = await service.from("engagement_scores").upsert(
    { user_id: userId, organization_id: orgIdForData, score: current + points },
    { onConflict: "user_id,organization_id" }
  );
  if (scoreErr) return { error: scoreErr.message };

  revalidatePath(`/${orgSlug}/admin/engagement`);
  return {};
}

