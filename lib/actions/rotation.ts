"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "../audit";
import { requireOrgAdminAction } from "../permissionsServer";
import { createSupabaseServiceRoleClient } from "../supabaseServer";
import type {
  AssignRotationFairOneResult,
  PreviewRotationForShiftResult,
  RotationPreviewBlocked,
  RotationPreviewRow
} from "../../types/rotation";

/**
 * Fair rotation: preview (`rotation_preview`) and assign (`rotation_assign`).
 * Org rotation settings: `app/[org]/settings/rotation-actions.ts`.
 * Member unavailability: `app/[org]/me/unavailability-actions.ts`.
 */

async function resolveShiftOrganizationId(shiftId: string): Promise<string | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service.from("shifts").select("organization_id").eq("id", shiftId).maybeSingle();
  return (data as { organization_id?: string | null } | null)?.organization_id ?? null;
}

function mapPreviewError(err: string): string {
  switch (err) {
    case "shift_not_found":
      return "rotation.error.shift_not_found";
    case "wrong_org":
      return "rotation.error.wrong_org";
    case "not_rotation_shift":
      return "rotation.error.not_rotation_shift";
    case "rotation_disabled":
      return "rotation.error.rotation_disabled";
    default:
      return "rotation.error.generic";
  }
}

export async function previewRotationForShift(shiftId: string): Promise<PreviewRotationForShiftResult> {
  const organizationId = await resolveShiftOrganizationId(shiftId);
  if (!organizationId) return { ok: false, errorKey: "common.unauthorized" };
  const actor = await requireOrgAdminAction(organizationId);
  if (!actor) return { ok: false, errorKey: "common.unauthorized" };

  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service.rpc("rotation_preview", {
    p_shift_id: shiftId,
    p_org_id: organizationId,
    p_team_ids: null
  });

  if (error) {
    console.error("rotation_preview", error.message);
    return { ok: false, errorKey: "rotation.error.rpc" };
  }

  const payload = data as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") {
    return { ok: false, errorKey: "rotation.error.generic" };
  }

  const err = payload.error;
  if (typeof err === "string" && err.length > 0) {
    return { ok: false, errorKey: mapPreviewError(err) };
  }

  const needed = Number(payload.needed);
  const sid = typeof payload.shift_id === "string" ? payload.shift_id : shiftId;
  const rawRows = payload.rows;
  const rows: RotationPreviewRow[] = [];
  if (Array.isArray(rawRows)) {
    for (const r of rawRows) {
      if (!r || typeof r !== "object") continue;
      const o = r as Record<string, unknown>;
      const blocked = o.blocked;
      let b: RotationPreviewBlocked = null;
      if (blocked === "already_assigned" || blocked === "unavailable") b = blocked;
      rows.push({
        user_id: String(o.user_id ?? ""),
        full_name: String(o.full_name ?? ""),
        score: Number(o.score ?? 0),
        last_assigned_at: o.last_assigned_at != null ? String(o.last_assigned_at) : null,
        last_shift_at: o.last_shift_at != null ? String(o.last_shift_at) : null,
        will_assign: Boolean(o.will_assign),
        blocked: b
      });
    }
  }

  return {
    ok: true,
    needed: Number.isFinite(needed) ? needed : 0,
    shiftId: sid,
    rows
  };
}

export async function assignRotationFairOne(shiftId: string): Promise<AssignRotationFairOneResult> {
  const organizationId = await resolveShiftOrganizationId(shiftId);
  if (!organizationId) return { ok: false, errorKey: "common.unauthorized" };
  const actor = await requireOrgAdminAction(organizationId);
  if (!actor) return { ok: false, errorKey: "common.unauthorized" };

  const service = createSupabaseServiceRoleClient();
  const { data: shift, error: shErr } = await service
    .from("shifts")
    .select("id, organization_id, assignment_kind, required_slots")
    .eq("id", shiftId)
    .maybeSingle();
  if (shErr || !shift || (shift as { assignment_kind?: string }).assignment_kind !== "rotation") {
    return { ok: false, errorKey: "rotation.error.not_rotation_shift" };
  }

  const { data: rpcResult, error: rpcErr } = await service.rpc("rotation_assign", {
    p_shift_id: shiftId,
    p_org_id: organizationId,
    p_team_ids: null
  });

  if (rpcErr) {
    console.error("rotation_assign", rpcErr.message);
    return { ok: false, errorKey: "rotation.error.rpc" };
  }

  const assigned = (rpcResult as { assigned?: number } | null)?.assigned ?? 0;
  const members = (rpcResult as { members?: unknown } | null)?.members;
  if (assigned > 0) {
    await writeAuditLog({
      organizationId,
      actorProfileId: actor.actorProfileId,
      action: "shift.rotation_assign",
      targetTable: "shift_assignments",
      targetId: shiftId,
      metadata: { assigned, members }
    });
    revalidatePath("/admin/shifts");
  }

  return { ok: true, assigned };
}
