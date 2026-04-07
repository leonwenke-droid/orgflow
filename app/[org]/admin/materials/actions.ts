"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { requireOrgAdminAction } from "../../../../lib/permissionsServer";
import { getCurrentOrganization, getOrgIdForData } from "../../../../lib/getOrganization";

export async function createResourceAction(
  orgSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const actor = await requireOrgAdminAction(orgIdForData, orgSlug);
  if (!actor) return { error: "Not authorized." };

  const service = createSupabaseServiceRoleClient();

  const description = String(formData.get("item_description") ?? "").trim();
  if (!description) return { error: "Description required." };

  const size = String(formData.get("size") ?? "medium");
  const category = String(formData.get("category") ?? "").trim() || null;
  const quantity = Math.max(1, Number(formData.get("quantity")) || 1);
  const quantityUnit = String(formData.get("quantity_unit") ?? "").trim() || null;
  const responsibleUserId = String(formData.get("responsible_user_id") ?? "").trim() || null;
  const neededBy = String(formData.get("needed_by") ?? "").trim() || null;
  const eventId = String(formData.get("event_id") ?? "").trim() || null;
  const source = String(formData.get("source") ?? "").trim() || null;

  let eventName: string | null = null;
  if (eventId) {
    const { data: ev } = await service.from("events").select("name").eq("id", eventId).maybeSingle();
    eventName = (ev as any)?.name ?? null;
  }

  const { error } = await service.from("material_procurements").insert({
    user_id: actor.actorProfileId,
    organization_id: orgIdForData,
    item_description: description,
    event_name: eventName || description,
    size,
    status: "offen",
    quantity,
    quantity_unit: quantityUnit,
    category,
    responsible_user_id: responsibleUserId,
    needed_by: neededBy,
    source,
    event_id: eventId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/admin/materials`);
  return {};
}

export async function updateResourceStatusAction(
  orgSlug: string,
  resourceId: string,
  newStatus: string
): Promise<{ error?: string }> {
  if (!["offen", "beschafft", "geliehen"].includes(newStatus))
    return { error: "Invalid status." };

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const actor = await requireOrgAdminAction(orgIdForData, orgSlug);
  if (!actor) return { error: "Not authorized." };

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("material_procurements")
    .update({ status: newStatus })
    .eq("id", resourceId);

  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/admin/materials`);
  return {};
}
