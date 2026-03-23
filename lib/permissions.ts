/**
 * Role-based permissions for OrgFlow
 * Maps DB roles to permission levels
 */

import type { DbRole } from "../types";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "./supabaseServer";

/** Roles that can manage org (teams, tasks, shifts, members) */
export const ADMIN_ROLES: DbRole[] = ["super_admin", "admin", "owner", "lead"];

/** Roles that can view/manage finance */
export const FINANCE_ROLES: DbRole[] = ["super_admin", "owner", "admin", "lead", "finance"];

/** Roles that can manage tasks within their team */
export const TEAM_LEAD_ROLES: DbRole[] = ["admin", "owner", "lead"];

/** Roles with read-only access */
export const VIEWER_ROLES: DbRole[] = ["viewer"];

/** Roles that can view (non-viewer) */
export const MEMBER_ROLES: DbRole[] = ["member", "lead", "admin", "owner", "super_admin"];

export function canManageOrg(role: DbRole | null | undefined): boolean {
  return role != null && ADMIN_ROLES.includes(role);
}

export function canManageTeamTasks(role: DbRole | null | undefined): boolean {
  return role != null && TEAM_LEAD_ROLES.includes(role);
}

export function canView(role: DbRole | null | undefined): boolean {
  return role != null && (MEMBER_ROLES.includes(role) || VIEWER_ROLES.includes(role));
}

export function canViewFinance(role: DbRole | null | undefined): boolean {
  return role != null && FINANCE_ROLES.includes(role);
}

export function isReadOnly(role: DbRole | null | undefined): boolean {
  return role != null && VIEWER_ROLES.includes(role);
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
