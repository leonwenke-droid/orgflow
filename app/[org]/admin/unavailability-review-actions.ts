"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { requireOrgAdminAction } from "../../../lib/permissionsServer";

export async function approveUnavailabilityAction(
  orgSlug: string,
  rowId: string
): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const actor = await requireOrgAdminAction(orgIdForData, orgSlug);
  if (!actor) return { error: "Not authorized." };

  const service = createSupabaseServiceRoleClient();
  const { data: row } = await service
    .from("member_unavailability")
    .select("id, organization_id, status")
    .eq("id", rowId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!row || (row as { status?: string }).status !== "pending") {
    return { error: "not_found" };
  }

  const { error } = await service
    .from("member_unavailability")
    .update({
      status: "approved",
      reviewed_by: actor.actorProfileId,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", rowId);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/admin`);
  revalidatePath(`/${orgSlug}/admin/unavailability`);
  revalidatePath(`/${orgSlug}/account`);
  return {};
}

export async function rejectUnavailabilityAction(
  orgSlug: string,
  rowId: string
): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const actor = await requireOrgAdminAction(orgIdForData, orgSlug);
  if (!actor) return { error: "Not authorized." };

  const service = createSupabaseServiceRoleClient();
  const { data: row } = await service
    .from("member_unavailability")
    .select("id, organization_id, status")
    .eq("id", rowId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!row || (row as { status?: string }).status !== "pending") {
    return { error: "not_found" };
  }

  const { error } = await service
    .from("member_unavailability")
    .update({
      status: "rejected",
      reviewed_by: actor.actorProfileId,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", rowId);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/admin`);
  revalidatePath(`/${orgSlug}/admin/unavailability`);
  revalidatePath(`/${orgSlug}/account`);
  return {};
}
