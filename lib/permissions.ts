/**
 * Role-based permissions for OrgFlow (safe to import from Client Components — no next/headers).
 */

import type { DbRole } from "../types";

/** Roles that can use operational admin tools (tasks/shifts/resources/engagement hub) */
export const OPERATIONAL_ADMIN_ROLES: DbRole[] = ["super_admin", "admin", "owner", "lead"];

/** Roles that count as org managers for legacy checks (includes lead) */
export const ADMIN_ROLES: DbRole[] = ["super_admin", "admin", "owner", "lead"];

/** Roles that can view/manage finance */
export const FINANCE_ROLES: DbRole[] = ["super_admin", "owner", "admin", "lead", "finance"];

/** Roles that can manage tasks within their team */
export const TEAM_LEAD_ROLES: DbRole[] = ["admin", "owner", "lead"];

/** Roles with read-only access */
export const VIEWER_ROLES: DbRole[] = ["viewer"];

/** Roles that can view (non-viewer) */
export const MEMBER_ROLES: DbRole[] = ["member", "lead", "admin", "owner", "super_admin", "finance"];

export function canManageOrg(role: DbRole | null | undefined): boolean {
  return role != null && ADMIN_ROLES.includes(role);
}

/**
 * Owner / Admin / Super-Admin: members, teams, org settings, and assigning org roles
 * (member / lead / admin / owner / finance / viewer). Team leads are excluded.
 */
export function canManageMembersAndTeams(role: DbRole | null | undefined): boolean {
  return role === "super_admin" || role === "admin" || role === "owner";
}

/** May change organisation name, modules, slug, etc. */
export function canChangeOrgSettings(role: DbRole | null | undefined): boolean {
  return role === "super_admin" || role === "admin" || role === "owner";
}

/** Admin hub, planning tools, engagement — includes Teamleads, excludes finance-only. */
export function canAccessOperationalAdmin(role: DbRole | null | undefined): boolean {
  return role != null && OPERATIONAL_ADMIN_ROLES.includes(role);
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
