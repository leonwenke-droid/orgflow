"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "../audit";
import { requireOrgAdminAction } from "../permissionsServer";
import { createSupabaseServiceRoleClient } from "../supabaseServer";
import { fetchEngagementEnabledForOrgId } from "../engagement/isEngagementEnabled";
import { getProfileIdsBlockedByApprovedUnavailability } from "../shiftUnavailability";
import type { AssignAutoAssignForShiftResult, PreviewAutoAssignForShiftResult } from "../../types/autoAssign";

const COOLDOWN_DAYS = 3;

function weightedRandomSelect<T extends { score: number }>(eligible: T[], count: number): T[] {
  const result: T[] = [];
  let pool = [...eligible];
  for (let n = 0; n < count && pool.length > 0; n++) {
    const maxScore = Math.max(...pool.map((m) => m.score));
    const weights = pool.map((m) => maxScore - m.score + 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalWeight;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= weights[idx];
      if (r <= 0) break;
    }
    idx = Math.min(idx, pool.length - 1);
    result.push(pool[idx]);
    pool = pool.slice(0, idx).concat(pool.slice(idx + 1));
  }
  return result;
}

async function resolveShiftOrganizationId(shiftId: string): Promise<string | null> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service.from("shifts").select("organization_id").eq("id", shiftId).maybeSingle();
  return (data as { organization_id?: string | null } | null)?.organization_id ?? null;
}

async function getUsersInCooldown(
  service: ReturnType<typeof createSupabaseServiceRoleClient>,
  orgId: string,
  shiftDateStr: string
): Promise<Set<string>> {
  const shiftDate = new Date(shiftDateStr + "T12:00:00Z");
  const minD = new Date(shiftDate);
  minD.setUTCDate(minD.getUTCDate() - COOLDOWN_DAYS);
  const maxD = new Date(shiftDate);
  maxD.setUTCDate(maxD.getUTCDate() - 1);
  const minStr = minD.toISOString().slice(0, 10);
  const maxStr = maxD.toISOString().slice(0, 10);

  const { data: cooldownShifts } = await service
    .from("shifts")
    .select("id")
    .eq("organization_id", orgId)
    .gte("date", minStr)
    .lte("date", maxStr);

  const shiftIds = (cooldownShifts ?? []).map((s: { id: string }) => s.id);
  if (shiftIds.length === 0) return new Set();

  const { data: assignments } = await service
    .from("shift_assignments")
    .select("user_id")
    .in("shift_id", shiftIds);

  return new Set((assignments ?? []).map((a: { user_id: string }) => a.user_id as string));
}

export async function previewAutoAssignForShift(shiftId: string): Promise<PreviewAutoAssignForShiftResult> {
  const organizationId = await resolveShiftOrganizationId(shiftId);
  if (!organizationId) return { ok: false, errorKey: "common.unauthorized" };
  const actor = await requireOrgAdminAction(organizationId);
  if (!actor) return { ok: false, errorKey: "common.unauthorized" };

  const service = createSupabaseServiceRoleClient();
  const { data: orgRow } = await service.from("organizations").select("plan").eq("id", organizationId).maybeSingle();
  if ((orgRow as { plan?: string | null } | null)?.plan === "free") return { ok: false, errorKey: "common.unauthorized" };
  if (!(await fetchEngagementEnabledForOrgId(service, organizationId))) return { ok: false, errorKey: "common.unauthorized" };

  const { data: shift } = await service
    .from("shifts")
    .select("id, organization_id, assignment_kind, required_slots, date")
    .eq("id", shiftId)
    .maybeSingle();

  const s = shift as { assignment_kind?: string | null; required_slots?: number | null; date?: string | null } | null;
  if (!s || s.assignment_kind !== "auto_assign") return { ok: false, errorKey: "common.unauthorized" };

  const required = Math.max(0, Number(s.required_slots ?? 0) || 0);
  const { data: existing } = await service.from("shift_assignments").select("user_id").eq("shift_id", shiftId);
  const alreadyAssigned = new Set((existing ?? []).map((a: any) => String(a.user_id ?? "")).filter(Boolean));
  const needed = Math.max(0, required - alreadyAssigned.size);

  const [{ data: profiles }, { data: scores }] = await Promise.all([
    service.from("profiles").select("id, full_name, role, status").eq("organization_id", organizationId).order("full_name"),
    service.from("engagement_scores").select("user_id, score").eq("organization_id", organizationId)
  ]);

  const scoreMap = new Map(
    (scores ?? []).map((r: { user_id: string; score?: number | null }) => [r.user_id, Number(r.score) ?? 0])
  );

  const cooldownUsers = s.date ? await getUsersInCooldown(service, organizationId, String(s.date).slice(0, 10)) : new Set<string>();
  const candidateIds = (profiles ?? [])
    .filter((p: any) => p.status !== "disabled" && p.role !== "viewer")
    .map((p: any) => String(p.id ?? ""))
    .filter(Boolean);
  const unavailable = await getProfileIdsBlockedByApprovedUnavailability(service, shiftId, candidateIds);

  const rows = (profiles ?? [])
    .filter((p: any) => p.status !== "disabled" && p.role !== "viewer")
    .map((p: any) => {
      const uid = String(p.id ?? "");
      const full_name = String(p.full_name ?? "");
      const score = scoreMap.get(uid) ?? 0;
      let blocked: "already_assigned" | "cooldown" | "unavailable" | null = null;
      if (alreadyAssigned.has(uid)) blocked = "already_assigned";
      else if (cooldownUsers.has(uid)) blocked = "cooldown";
      else if (unavailable.has(uid)) blocked = "unavailable";
      return { user_id: uid, full_name, score, blocked };
    })
    .sort((a, b) => (a.score - b.score) || a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" }));

  return { ok: true, needed, shiftId, rows };
}

export async function assignAutoAssignForShift(shiftId: string): Promise<AssignAutoAssignForShiftResult> {
  const organizationId = await resolveShiftOrganizationId(shiftId);
  if (!organizationId) return { ok: false, errorKey: "common.unauthorized" };
  const actor = await requireOrgAdminAction(organizationId);
  if (!actor) return { ok: false, errorKey: "common.unauthorized" };

  const service = createSupabaseServiceRoleClient();
  const { data: orgRow } = await service.from("organizations").select("plan").eq("id", organizationId).maybeSingle();
  if ((orgRow as { plan?: string | null } | null)?.plan === "free") return { ok: false, errorKey: "common.unauthorized" };
  if (!(await fetchEngagementEnabledForOrgId(service, organizationId))) return { ok: false, errorKey: "common.unauthorized" };

  const { data: shift } = await service
    .from("shifts")
    .select("id, organization_id, assignment_kind, required_slots, date")
    .eq("id", shiftId)
    .maybeSingle();
  const s = shift as { assignment_kind?: string | null; required_slots?: number | null; date?: string | null } | null;
  if (!s || s.assignment_kind !== "auto_assign") return { ok: false, errorKey: "common.unauthorized" };

  const required = Math.max(0, Number(s.required_slots ?? 0) || 0);
  const { data: existing } = await service.from("shift_assignments").select("user_id").eq("shift_id", shiftId);
  const alreadyAssigned = new Set((existing ?? []).map((a: any) => String(a.user_id ?? "")).filter(Boolean));
  const needed = Math.max(0, required - alreadyAssigned.size);
  if (needed <= 0) return { ok: true, assigned: 0 };

  const [{ data: profiles }, { data: scores }] = await Promise.all([
    service.from("profiles").select("id, full_name, role, status").eq("organization_id", organizationId).order("full_name"),
    service.from("engagement_scores").select("user_id, score").eq("organization_id", organizationId)
  ]);

  const scoreMap = new Map(
    (scores ?? []).map((r: { user_id: string; score?: number | null }) => [r.user_id, Number(r.score) ?? 0])
  );

  const cooldownUsers = s.date ? await getUsersInCooldown(service, organizationId, String(s.date).slice(0, 10)) : new Set<string>();
  const candidateIds = (profiles ?? [])
    .filter((p: any) => p.status !== "disabled" && p.role !== "viewer")
    .map((p: any) => String(p.id ?? ""))
    .filter(Boolean);
  const unavailable = await getProfileIdsBlockedByApprovedUnavailability(service, shiftId, candidateIds);

  const eligible = (profiles ?? [])
    .filter((p: any) => p.status !== "disabled" && p.role !== "viewer")
    .map((p: any) => ({
      user_id: String(p.id ?? ""),
      full_name: String(p.full_name ?? ""),
      score: scoreMap.get(String(p.id ?? "")) ?? 0
    }))
    .filter((m) => m.user_id && !alreadyAssigned.has(m.user_id) && !cooldownUsers.has(m.user_id) && !unavailable.has(m.user_id));

  const picked = weightedRandomSelect(eligible, needed);
  if (picked.length === 0) return { ok: true, assigned: 0 };

  const rows = picked.map((m) => ({ shift_id: shiftId, user_id: m.user_id, status: "zugewiesen" }));
  const { error } = await service.from("shift_assignments").insert(rows);
  if (error) return { ok: false, errorKey: "common.error_generic" };

  await writeAuditLog({
    organizationId,
    actorProfileId: actor.actorProfileId,
    action: "shift.auto_assign",
    targetTable: "shift_assignments",
    targetId: shiftId,
    metadata: { assigned: picked.length, members: picked }
  });

  revalidatePath("/admin/shifts");
  return { ok: true, assigned: picked.length, members: picked };
}

