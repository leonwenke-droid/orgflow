"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "../audit";
import { requireOrgAdminAction } from "../permissionsServer";
import { createSupabaseServiceRoleClient } from "../supabaseServer";
import { notifyShiftAssignedByEmail } from "../shiftAssignmentNotifications";
import { fetchOrgSlugById } from "../resolveOrgSlug";
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

async function resolveOrgSlug(organizationId: string): Promise<string | null> {
  const service = createSupabaseServiceRoleClient();
  return fetchOrgSlugById(service, organizationId);
}

function unwrapRotationAssignPayload(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (typeof data === "string") {
    try {
      const p = JSON.parse(data) as unknown;
      return p && typeof p === "object" ? (p as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof data === "object") return data as Record<string, unknown>;
  return null;
}

/** `rotation_assign` returns `members` as JSON array of UUID strings (see `to_jsonb(v_ids)` in SQL). */
function profileIdsFromRotationRpcMembers(members: unknown): string[] {
  let raw: unknown = members;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const m of raw) {
    if (typeof m === "string") {
      const s = m.trim();
      if (s) out.push(s);
      continue;
    }
    if (m && typeof m === "object") {
      const o = m as Record<string, unknown>;
      const id = String(o.user_id ?? o.id ?? "").trim();
      if (id) out.push(id);
    }
  }
  return [...new Set(out)];
}

async function profileIdsFallbackFromAssignments(
  service: ReturnType<typeof createSupabaseServiceRoleClient>,
  shiftId: string,
  count: number
): Promise<string[]> {
  if (count <= 0) return [];
  const { data, error } = await service
    .from("shift_assignments")
    .select("user_id")
    .eq("shift_id", shiftId)
    .order("created_at", { ascending: false })
    .limit(count);
  if (error || !data?.length) return [];
  return [...new Set((data as { user_id: string }[]).map((r) => String(r.user_id ?? "")).filter(Boolean))];
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

  const payload = unwrapRotationAssignPayload(rpcResult);
  const assigned = Number(payload?.assigned ?? 0);
  const members = payload?.members;
  if (assigned > 0) {
    await writeAuditLog({
      organizationId,
      actorProfileId: actor.actorProfileId,
      action: "shift.rotation_assign",
      targetTable: "shift_assignments",
      targetId: shiftId,
      metadata: { assigned, members }
    });
    // Notify newly assigned members (non-self assignment).
    const orgSlug = await resolveOrgSlug(organizationId);
    let ids = profileIdsFromRotationRpcMembers(members);
    if (ids.length === 0) {
      ids = await profileIdsFallbackFromAssignments(service, shiftId, assigned);
      if (ids.length === 0) {
        console.error(
          "[rotation] rotation_assign reported assigned=%s but no profile ids (members=%s)",
          assigned,
          JSON.stringify(members)?.slice(0, 500)
        );
      }
    }
    if (orgSlug && ids.length > 0) {
      await Promise.allSettled(
        ids.map((profileId) =>
          notifyShiftAssignedByEmail({ service, profileId, shiftId, orgSlug })
        )
      );
    } else if (!orgSlug) {
      console.error("[rotation] no org slug for organization_id=%s — skip shift-assigned webhooks", organizationId);
    }
    revalidatePath("/admin/shifts");
  }

  return { ok: true, assigned };
}
