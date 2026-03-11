/**
 * OrgFlow type definitions
 */

export type OrgRole = "owner" | "admin" | "team_lead" | "member" | "viewer";

export type DbRole = "super_admin" | "admin" | "lead" | "member" | "owner" | "viewer";
// DB uses: admin, lead, member. owner/viewer added via migration for future.

export interface OrgMember {
  id: string;
  full_name: string | null;
  role: DbRole;
  email?: string | null;
  organization_id?: string | null;
}

export interface InviteLink {
  token: string;
  url: string;
  expiresAt: string;
}
