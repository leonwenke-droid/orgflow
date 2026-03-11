/**
 * Role-based permissions for OrgFlow
 * Maps DB roles to permission levels
 */

import type { DbRole } from "../types";

/** Roles that can manage org (teams, tasks, shifts, members) */
export const ADMIN_ROLES: DbRole[] = ["super_admin", "admin", "owner", "lead"];

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

export function isReadOnly(role: DbRole | null | undefined): boolean {
  return role != null && VIEWER_ROLES.includes(role);
}
