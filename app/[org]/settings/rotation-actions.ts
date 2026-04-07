"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrganization } from "../../../lib/getOrganization";
import { assertCanChangeOrgSettings } from "../../../lib/permissionsServer";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { mergeRotationConfig, type RotationConfig } from "../../../lib/rotationConfig";

export async function updateRotationConfigAction(
  orgSlug: string,
  partial: Partial<RotationConfig>
): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  if (!(await assertCanChangeOrgSettings(orgSlug, org))) {
    return { error: "Not authorized." };
  }

  const service = createSupabaseServiceRoleClient();
  const { data: row, error: fetchErr } = await service
    .from("organizations")
    .select("rotation_config")
    .eq("id", org.id)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };

  const current = mergeRotationConfig((row as { rotation_config?: unknown } | null)?.rotation_config);
  const next: Required<RotationConfig> = {
    ...current,
    ...partial,
    enabled: typeof partial.enabled === "boolean" ? partial.enabled : current.enabled,
    pts_on_shift_done:
      typeof partial.pts_on_shift_done === "number" ? partial.pts_on_shift_done : current.pts_on_shift_done,
    pts_on_assignment:
      typeof partial.pts_on_assignment === "number" ? partial.pts_on_assignment : current.pts_on_assignment,
    pts_cooldown_per_day:
      typeof partial.pts_cooldown_per_day === "number"
        ? partial.pts_cooldown_per_day
        : current.pts_cooldown_per_day,
    allow_swap: typeof partial.allow_swap === "boolean" ? partial.allow_swap : current.allow_swap,
    notify_on_assignment:
      typeof partial.notify_on_assignment === "boolean"
        ? partial.notify_on_assignment
        : current.notify_on_assignment
  };

  const { error } = await service.from("organizations").update({ rotation_config: next }).eq("id", org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/settings`);
  revalidatePath(`/${orgSlug}/admin`);
  return {};
}
