"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceRoleClient } from "../supabaseServer";
import { requireOrgAdminAction } from "../permissionsServer";
import type { AttendanceStatus } from "../../types/shifts";

async function assignmentOrganizationId(assignmentId: string): Promise<string | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("shift_assignments")
    .select("shifts!inner(organization_id)")
    .eq("id", assignmentId)
    .maybeSingle();
  const row = data as { shifts?: { organization_id?: string } | null } | null;
  return row?.shifts?.organization_id ?? null;
}

/**
 * Manual attendance confirmation (admin). Maps spec statuses to OrgFlow shift_assignments + triggers.
 */
export async function confirmAttendanceManual(
  assignmentId: string,
  orgSlug: string,
  status: "present" | "absent" | "excused"
): Promise<void> {
  const organizationId = await assignmentOrganizationId(assignmentId);
  if (!organizationId) throw new Error("Assignment not found.");

  const actor = await requireOrgAdminAction(organizationId, orgSlug);
  if (!actor) throw new Error("Insufficient permissions.");

  const service = createSupabaseServiceRoleClient();
  const nowIso = new Date().toISOString();

  if (status === "present") {
    const { error } = await service
      .from("shift_assignments")
      .update({
        status: "erledigt",
        checked_in_at: nowIso,
        checked_in_by: actor.actorProfileId,
        check_in_method: "manual",
        attendance_status: "present" satisfies AttendanceStatus
      })
      .eq("id", assignmentId);
    if (error) throw new Error(error.message);
  } else if (status === "absent") {
    const { error } = await service
      .from("shift_assignments")
      .update({
        status: "abgesagt",
        checked_in_at: null,
        check_in_method: null,
        attendance_status: "absent"
      })
      .eq("id", assignmentId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await service
      .from("shift_assignments")
      .update({
        attendance_status: "excused",
        checked_in_at: null,
        check_in_method: null
      })
      .eq("id", assignmentId);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/shifts");
  revalidatePath(`/${orgSlug}/admin/shifts`);
}
