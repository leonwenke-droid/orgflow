"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { requireOrgAdminAction } from "../../../lib/permissionsServer";
import { writeAuditLog } from "../../../lib/audit";
import { isMissingSoftDeleteColumnError } from "../../../lib/supabaseSoftDelete";

export type DeletedShiftRow = {
  id: string;
  event_name: string | null;
  date: string | null;
  start_time: string | null;
  deleted_at: string | null;
};

async function resolveShiftOrganizationId(shiftId: string): Promise<string | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service.from("shifts").select("organization_id").eq("id", shiftId).maybeSingle();
  return (data as { organization_id?: string } | null)?.organization_id ?? null;
}

export async function loadDeletedShifts(
  orgId: string | null
): Promise<{ ok: true; items: DeletedShiftRow[] } | { ok: false; error: string }> {
  if (!orgId) return { ok: false, error: "no_org" };
  const actor = await requireOrgAdminAction(orgId);
  if (!actor) return { ok: false, error: "forbidden" };
  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service
    .from("shifts")
    .select("id, event_name, date, start_time, deleted_at")
    .not("deleted_at", "is", null)
    .eq("organization_id", orgId)
    .order("deleted_at", { ascending: false })
    .limit(50);
  if (error && isMissingSoftDeleteColumnError(error.message)) {
    return { ok: true, items: [] };
  }
  if (error) return { ok: false, error: error.message };
  return { ok: true, items: (data ?? []) as DeletedShiftRow[] };
}

export async function restoreShiftFromTrash(formData: FormData) {
  const shiftId = String(formData.get("shiftId") ?? "").trim();
  if (!shiftId) return;
  const organizationId = await resolveShiftOrganizationId(shiftId);
  if (!organizationId) return;
  const actor = await requireOrgAdminAction(organizationId);
  if (!actor) return;
  const service = createSupabaseServiceRoleClient();
  await service.from("shifts").update({ deleted_at: null, deleted_by: null }).eq("id", shiftId);
  await writeAuditLog({
    organizationId,
    actorProfileId: actor.actorProfileId,
    action: "shift.restored",
    targetTable: "shifts",
    targetId: shiftId
  });
  revalidatePath("/admin/shifts");
  revalidatePath("/dashboard");
}
