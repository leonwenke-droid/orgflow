import { getCurrentOrganization, getOrgIdForData } from "./getOrganization";
import { createSupabaseServiceRoleClient } from "./supabaseServer";

export type ClaimShiftForMemberResult =
  | { ok: true; profileId: string; organizationId: string }
  | { ok: false; code: ClaimShiftErrorCode };

export type ClaimShiftErrorCode =
  | "not_signed_in"
  | "shift_not_found"
  | "wrong_org"
  | "not_claimable"
  | "full"
  | "not_member"
  | "viewer"
  | "insert_failed";

/** Exported for check-in and other server routes that resolve a member profile in org context. */
export function pickProfileForShiftClaim(
  profiles: { id: string; organization_id: string; role: string | null; status: string | null }[],
  shiftOrgId: string,
  allowedOrgIds: string[]
): { id: string; organization_id: string; role: string | null; status: string | null } | null {
  const active = profiles.filter(
    (p) => (p.status ?? "active") !== "disabled" && (p.role ?? "") !== "viewer"
  );
  const exact = active.find((p) => p.organization_id === shiftOrgId);
  if (exact) return exact;
  if (!allowedOrgIds.includes(shiftOrgId)) return null;
  return active.find((p) => allowedOrgIds.includes(p.organization_id)) ?? null;
}

/**
 * Schicht-Selbsteintragung mit Service-Role (umgeht RLS/RPC-Probleme), aber streng geprüft:
 * Schicht muss zu organizationIdFromForm passen; Nutzer muss Profil in derselben „Org-Kontext“-Menge haben
 * (org.id + getOrgIdForData, inkl. Slug-/Alias-Mapping).
 */
export async function claimShiftForAuthenticatedMember(opts: {
  authUserId: string;
  orgSlug: string;
  shiftId: string;
  /** Wie im Dashboard/Schichten-Formular: effectiveOrgIdForData */
  organizationIdFromForm: string;
}): Promise<ClaimShiftForMemberResult> {
  const { authUserId, orgSlug, shiftId, organizationIdFromForm } = opts;
  if (!authUserId || !orgSlug.trim() || !shiftId.trim() || !organizationIdFromForm.trim()) {
    return { ok: false, code: "wrong_org" };
  }

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const allowedOrgIds = [...new Set([org.id, orgIdForData])];

  if (!allowedOrgIds.includes(organizationIdFromForm)) {
    return { ok: false, code: "wrong_org" };
  }

  const service = createSupabaseServiceRoleClient();

  const { data: shift, error: shiftErr } = await service
    .from("shifts")
    .select("id, organization_id, claimable, auto_assign, required_slots")
    .eq("id", shiftId)
    .maybeSingle();

  if (shiftErr || !shift) {
    return { ok: false, code: "shift_not_found" };
  }

  if (shift.organization_id !== organizationIdFromForm) {
    return { ok: false, code: "wrong_org" };
  }

  if (shift.auto_assign === true || shift.claimable === false) {
    return { ok: false, code: "not_claimable" };
  }

  const required = Math.max(1, Number(shift.required_slots ?? 1) || 1);
  const { count, error: countErr } = await service
    .from("shift_assignments")
    .select("id", { count: "exact", head: true })
    .eq("shift_id", shiftId);

  if (countErr || count == null) {
    return { ok: false, code: "shift_not_found" };
  }
  if (count >= required) {
    return { ok: false, code: "full" };
  }

  const { data: profiles, error: profErr } = await service
    .from("profiles")
    .select("id, organization_id, role, status")
    .eq("auth_user_id", authUserId)
    .in("organization_id", allowedOrgIds);

  if (profErr || !profiles?.length) {
    return { ok: false, code: "not_member" };
  }

  const profile = pickProfileForShiftClaim(
    profiles as { id: string; organization_id: string; role: string | null; status: string | null }[],
    shift.organization_id as string,
    allowedOrgIds
  );

  if (!profile) {
    return { ok: false, code: "not_member" };
  }
  if ((profile.role ?? "") === "viewer") {
    return { ok: false, code: "viewer" };
  }

  const { error: insErr } = await service.from("shift_assignments").insert({
    shift_id: shiftId,
    user_id: profile.id,
    status: "zugewiesen"
  });

  if (insErr) {
    if (insErr.code === "23505" || /duplicate|unique/i.test(insErr.message)) {
      return { ok: false, code: "full" };
    }
    console.error("[claimShiftForMember] insert", insErr);
    return { ok: false, code: "insert_failed" };
  }

  return {
    ok: true,
    profileId: profile.id,
    organizationId: organizationIdFromForm
  };
}
