/**
 * Server-only permission guards (uses next/headers). Do not import from Client Components.
 */

import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { DbRole } from "../types";
import {
  type Organization,
  fetchActiveOrganizationBySlug,
  getCurrentUserRoleInOrg,
  getEffectiveUserRoleForOrg,
  getOrgIdForData,
  isOrgAdmin,
  resolveMemberProfileForOrganization
} from "./getOrganization";
import { createSupabaseServiceRoleClient } from "./supabaseServer";
import {
  canChangeOrgSettings,
  canManageMembersAndTeams,
  canManageOrg
} from "./permissions";

/** Server: is org admin RPC + darf Mitglieder/Teams verwalten (nicht Lead). */
export async function assertCanManageMembersAndTeams(
  orgIdForData: string,
  canonicalOrgId?: string | null,
  orgSlug?: string | null
): Promise<boolean> {
  if (!(await isOrgAdmin(orgIdForData, orgSlug))) return false;
  const role = await getCurrentUserRoleInOrg(orgIdForData, canonicalOrgId);
  return canManageMembersAndTeams(role);
}

/** Server: darf Organisationseinstellungen ändern (admin/owner/super; nicht Lead). Nutzt effektive Rolle inkl. Legacy-Org-Zuordnung. */
export async function assertCanChangeOrgSettings(orgSlug: string, org: Organization): Promise<boolean> {
  const role = await getEffectiveUserRoleForOrg(orgSlug, org);
  return canChangeOrgSettings(role);
}

/**
 * Server: darf operative Admin-Aktionen ausführen (Admin/Owner/Lead/Teamlead/Super laut canManageOrg).
 * Optional `orgSlug` bevorzugen, wenn `organization_id` auf dem Profil von der Daten-Ebene abweicht (Legacy).
 */
export async function requireOrgAdminAction(
  organizationId: string,
  orgSlug?: string | null
): Promise<{ actorProfileId: string; role: DbRole } | null> {
  const orgId = String(organizationId ?? "").trim();
  if (!orgId) return null;

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const service = createSupabaseServiceRoleClient();
  const slug = String(orgSlug ?? "").trim();

  if (slug) {
    const org = await fetchActiveOrganizationBySlug(slug);
    if (!org) return null;
    const member = await resolveMemberProfileForOrganization(user.id, slug, org);
    if (!member || !canManageOrg(member.role as DbRole)) return null;
    const allowed = new Set(
      [org.id, getOrgIdForData(slug, org.id), member.organization_id]
        .map((x) => String(x ?? "").trim())
        .filter(Boolean)
    );
    if (!allowed.has(orgId)) return null;
    return { actorProfileId: member.id, role: member.role as DbRole };
  }

  const { data: profile } = await service
    .from("profiles")
    .select("id, role, status")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (
    profile?.id &&
    profile.status !== "disabled" &&
    canManageOrg((profile.role as DbRole | undefined) ?? null)
  ) {
    return { actorProfileId: profile.id as string, role: profile.role as DbRole };
  }

  const { data: rows } = await service
    .from("profiles")
    .select("id, role, status, organization_id")
    .eq("auth_user_id", user.id);
  const active = (rows ?? []).filter(
    (p) => p.status !== "disabled" && p.organization_id
  ) as { id: string; role: string; organization_id: string }[];

  for (const p of active) {
    const { data: o } = await service
      .from("organizations")
      .select("id, slug")
      .eq("id", p.organization_id)
      .eq("is_active", true)
      .maybeSingle();
    const row = o as { id: string; slug: string } | null;
    if (!row?.slug) continue;
    const dataPlaneId = getOrgIdForData(row.slug, row.id);
    if (String(dataPlaneId) === orgId || String(row.id) === orgId) {
      if (canManageOrg(p.role as DbRole)) {
        return { actorProfileId: p.id, role: p.role as DbRole };
      }
    }
  }

  return null;
}
