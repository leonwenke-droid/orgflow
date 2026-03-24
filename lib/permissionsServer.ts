/**
 * Server-only permission guards (uses next/headers). Do not import from Client Components.
 */

import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { DbRole } from "../types";
import {
  type Organization,
  getCurrentUserRoleInOrg,
  getEffectiveUserRoleForOrg,
  isOrgAdmin
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
  canonicalOrgId?: string | null
): Promise<boolean> {
  if (!(await isOrgAdmin(orgIdForData))) return false;
  const role = await getCurrentUserRoleInOrg(orgIdForData, canonicalOrgId);
  return canManageMembersAndTeams(role);
}

/** Server: darf Organisationseinstellungen ändern (admin/owner/super; nicht Lead). Nutzt effektive Rolle inkl. Legacy-Org-Zuordnung. */
export async function assertCanChangeOrgSettings(orgSlug: string, org: Organization): Promise<boolean> {
  const role = await getEffectiveUserRoleForOrg(orgSlug, org);
  return canChangeOrgSettings(role);
}

export async function requireOrgAdminAction(
  organizationId: string
): Promise<{ actorProfileId: string; role: DbRole } | null> {
  const orgId = String(organizationId ?? "").trim();
  if (!orgId) return null;
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const { data: adminOk } = await supabase.rpc("is_org_admin", { org_id: orgId });
  if (adminOk !== true) return null;

  const service = createSupabaseServiceRoleClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!profile?.id || !canManageOrg((profile.role as DbRole | undefined) ?? null)) return null;
  return {
    actorProfileId: profile.id as string,
    role: profile.role as DbRole
  };
}
