"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { requireOrgAdminAction } from "../../../lib/permissionsServer";
import { writeAuditLog } from "../../../lib/audit";

const STATUSES = new Set(["offen", "in_arbeit", "erledigt", "ueberfaellig"]);

export async function updateTaskKanbanStatus(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  const orgSlug = String(formData.get("org_slug") ?? "").trim();
  if (!taskId || !status || !organizationId || !STATUSES.has(status)) return;

  const actor = await requireOrgAdminAction(organizationId, orgSlug || null);
  if (!actor) return;

  const service = createSupabaseServiceRoleClient();

  const { data: taskRow } = await service
    .from("tasks")
    .select("event_id")
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  await service.from("tasks").update({ status }).eq("id", taskId).eq("organization_id", organizationId);
  await writeAuditLog({
    organizationId,
    actorProfileId: actor.actorProfileId,
    action: "task.status_updated",
    targetTable: "tasks",
    targetId: taskId,
    metadata: { status }
  });

  revalidatePath("/admin/tasks");
  revalidatePath("/admin/tasks/trash");
  if (orgSlug) {
    revalidatePath(`/admin/tasks?org=${encodeURIComponent(orgSlug)}`);
    revalidatePath(`/admin/tasks/trash?org=${encodeURIComponent(orgSlug)}`);
    revalidatePath(`/${orgSlug}/tasks`);
    if ((taskRow as any)?.event_id) {
      revalidatePath(`/${orgSlug}/admin/events/${(taskRow as any).event_id}`);
    }
  }
}

export async function deleteTask(formData: FormData) {
  const taskId = formData.get("taskId")?.toString();
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  const orgSlug = String(formData.get("org_slug") ?? "").trim();
  if (!taskId || !organizationId) return;
  const actor = await requireOrgAdminAction(organizationId, orgSlug || null);
  if (!actor) return;
  const service = createSupabaseServiceRoleClient();
  await service
    .from("tasks")
    .update({ deleted_at: new Date().toISOString(), deleted_by: actor.actorProfileId })
    .eq("id", taskId)
    .eq("organization_id", organizationId);
  await writeAuditLog({
    organizationId,
    actorProfileId: actor.actorProfileId,
    action: "task.soft_deleted",
    targetTable: "tasks",
    targetId: taskId
  });
  revalidatePath("/admin/tasks");
  revalidatePath("/admin/tasks/trash");
  if (orgSlug) {
    revalidatePath(`/admin/tasks?org=${encodeURIComponent(orgSlug)}`);
    revalidatePath(`/admin/tasks/trash?org=${encodeURIComponent(orgSlug)}`);
    revalidatePath(`/${orgSlug}/tasks`);
    revalidatePath(`/${orgSlug}/dashboard`);
    revalidatePath(`/${orgSlug}/overview`);
  }
}

export async function restoreTask(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "").trim();
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  const orgSlug = String(formData.get("org_slug") ?? "").trim();
  if (!taskId || !organizationId) return;
  const actor = await requireOrgAdminAction(organizationId, orgSlug || null);
  if (!actor) return;
  const service = createSupabaseServiceRoleClient();
  await service
    .from("tasks")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", taskId)
    .eq("organization_id", organizationId);
  await writeAuditLog({
    organizationId,
    actorProfileId: actor.actorProfileId,
    action: "task.restored",
    targetTable: "tasks",
    targetId: taskId
  });
  revalidatePath("/admin/tasks");
  revalidatePath("/admin/tasks/trash");
  if (orgSlug) {
    revalidatePath(`/admin/tasks?org=${encodeURIComponent(orgSlug)}`);
    revalidatePath(`/admin/tasks/trash?org=${encodeURIComponent(orgSlug)}`);
    revalidatePath(`/${orgSlug}/tasks`);
  }
}
