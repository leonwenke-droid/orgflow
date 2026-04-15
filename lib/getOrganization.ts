import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { DbRole } from "../types";
import type { RotationConfig } from "./rotationConfig";
import { createSupabaseServiceRoleClient } from "./supabaseServer";

/** Organisations the current user belongs to (for /dashboard hub). */
export type UserOrgMembership = {
  id: string;
  slug: string;
  name: string;
  role: DbRole | null;
  /** Optional profile.email in that org (invite); may differ from auth email. */
  profileEmail?: string | null;
};

/**
 * Canonical organization id for data keyed to the resolved org row (from URL slug or subdomain,
 * including matches via `organizations.slug_aliases`).
 */
export function getOrgIdForData(_orgSlug: string, orgId: string): string {
  return String(orgId ?? "").trim();
}

/**
 * Match a profile row to the org opened in the URL (canonical id + mapped id if ever split).
 * Fetch profiles with `.eq("auth_user_id", userId)` only, then pass rows here.
 */
export function pickProfileForOrgAccess<T extends { id: string; organization_id?: string | null; status?: string | null }>(
  rows: T[] | null | undefined,
  orgSlug: string,
  org: { id: string }
): T | null {
  const cand = new Set([getOrgIdForData(orgSlug, org.id), org.id].map((x) => String(x).trim()).filter(Boolean));
  const list = rows ?? [];
  return (
    list.find(
      (p) => p.organization_id != null && cand.has(String(p.organization_id)) && p.status !== "disabled"
    ) ?? null
  );
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  plan?: "free" | "team" | "pro";
  school_name: string;
  school_short: string | null;
  school_city: string | null;
  year: number;
  slug_aliases?: string[];
  settings: {
    currency?: string;
    timezone?: string;
    /** When `"en"` or `"de"`, member Excel template download uses that language; otherwise UI locale is used. */
    locale?: string;
    features?: Record<string, boolean>;
    engagement_weights?: Record<string, number>;
    contact_email?: string;
    contact_phone?: string;
    /** DB opt-in for legacy admin bulk repair (dangerous). */
    legacy_bulk_sync?: boolean;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
  setup_token?: string | null;
  setup_token_used_at?: string | null;
  /** Fair rotation weights (JSONB); see rotation_assign / apply_rotation_daily_decay. */
  rotation_config?: RotationConfig | null;
}

function orgIdentifierTokens(
  o: Pick<Organization, "slug" | "subdomain" | "slug_aliases"> & { id?: string }
): Set<string> {
  const norm = (s: string | null | undefined) => String(s ?? "").trim().toLowerCase();
  return new Set(
    [o.slug, o.subdomain, ...(o.slug_aliases ?? [])].map(norm).filter(Boolean)
  );
}

/** True if the profile's organization row is the same as URL-resolved org (by id or slug/alias overlap). */
function profileOrgMatchesResolvedOrg(
  resolvedOrg: Organization,
  profileOrg: { id: string; slug: string; subdomain: string | null; slug_aliases?: string[] | null },
  urlSlug: string
): boolean {
  if (profileOrg.id === resolvedOrg.id) return true;
  const a = orgIdentifierTokens(resolvedOrg);
  const nu = String(urlSlug ?? "").trim().toLowerCase();
  if (nu) a.add(nu);
  const b = orgIdentifierTokens(profileOrg as unknown as Organization);
  for (const t of b) {
    if (a.has(t)) return true;
  }
  return false;
}

/**
 * Reliable membership for the org opened in the URL (service role).
 * Use for Feedback, Gesamtübersicht, etc. when profile.organization_id may not equal org.id (legacy / aliases).
 */
export async function resolveMemberProfileForOrganization(
  userId: string,
  orgSlug: string,
  org: Organization
): Promise<{ id: string; organization_id: string; role: DbRole | null } | null> {
  const service = createSupabaseServiceRoleClient();
  const { data: rows } = await service
    .from("profiles")
    .select("id, status, organization_id, role")
    .eq("auth_user_id", userId);

  const active = (rows ?? []).filter(
    (p) => p.status !== "disabled" && p.organization_id
  ) as { id: string; organization_id: string; role: DbRole | null }[];

  for (const p of active) {
    if (p.organization_id === org.id) return p;
  }

  const distinctIds = [...new Set(active.map((p) => String(p.organization_id)))];
  if (distinctIds.length === 0) return null;

  const { data: orgRows } = await service
    .from("organizations")
    .select("id, slug, subdomain, slug_aliases")
    .in("id", distinctIds);

  for (const p of active) {
    const pOrg = (orgRows ?? []).find((r: { id: string }) => r.id === p.organization_id);
    if (pOrg && profileOrgMatchesResolvedOrg(org, pOrg, orgSlug)) return p;
  }

  return null;
}

/**
 * Resolve an active organisation by public URL slug, subdomain, or `slug_aliases`.
 * Uses the service role so `/[org]/login` and API routes work while logged out (RLS often hides `organizations`).
 */
export async function fetchActiveOrganizationBySlug(
  slugOrSubdomain: string
): Promise<Organization | null> {
  const service = createSupabaseServiceRoleClient();
  const value = String(slugOrSubdomain).trim();
  if (!value) return null;
  const quoted = `"${value.replace(/"/g, '""')}"`;

  let { data: org, error } = await service
    .from("organizations")
    .select("*")
    .or(`slug.eq.${quoted},subdomain.eq.${quoted}`)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return null;

  if (!org) {
    const { data: aliasRows, error: aliasError } = await service
      .from("organizations")
      .select("*")
      .eq("is_active", true)
      .contains("slug_aliases", [value]);

    if (aliasError || !aliasRows?.length) return null;
    if (aliasRows.length !== 1) return null;
    org = aliasRows[0];
  }

  const o = org as Organization;
  if (typeof o.name === "string") o.name = o.name.trim();
  return o;
}

/**
 * Holt Organization basierend auf Slug ODER Subdomain
 * (wird später von org-spezifischen Routen und Landingpage genutzt).
 */
export async function getCurrentOrganization(
  slugOrSubdomain: string
): Promise<Organization> {
  const org = await fetchActiveOrganizationBySlug(slugOrSubdomain);
  if (!org) notFound();
  return org;
}

/**
 * Holt ALLE aktiven Organizations (für Landing Page, Super-Admin).
 */
export async function getAllOrganizations(): Promise<Organization[]> {
  const supabase = createServerComponentClient({ cookies });

  const { data: orgs } = await supabase
    .from("organizations")
    .select("*")
    .eq("is_active", true)
    .order("year", { ascending: false })
    .order("school_short");

  const list = (orgs as Organization[]) || [];
  list.forEach((o) => { if (typeof o.name === "string") o.name = o.name.trim(); });
  return list;
}

const ORG_ADMIN_ACCESS_ROLES = new Set<string>(["admin", "owner", "lead", "teamlead"]);

function roleAllowsOrgAdminArea(role: string | null | undefined): boolean {
  return role != null && ORG_ADMIN_ACCESS_ROLES.has(String(role));
}

/**
 * Prüft, ob der aktuelle User operative Org-Admin-Rechte hat (admin/owner/lead/teamlead) für diese Organisation,
 * oder Plattform-Super-Admin. Berücksichtigt Legacy (Profil.organization_id ≠ organisations.id) wie
 * resolveMemberProfileForOrganization.
 *
 * @param orgSlug optional URL-Slug — beschleunigt Auflösung; ohne Slug wird bei Bedarf die Org per `orgId` geladen.
 */
export async function isOrgAdmin(orgId: string, orgSlug?: string | null): Promise<boolean> {
  const id = String(orgId ?? "").trim();
  if (!id) return false;

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data: profileForOrg } = await supabase
    .from("profiles")
    .select("role, organization_id, status")
    .eq("auth_user_id", user.id)
    .eq("organization_id", id)
    .maybeSingle();

  if (profileForOrg?.status !== "disabled") {
    const r = profileForOrg?.role as string | undefined;
    if (roleAllowsOrgAdminArea(r)) return true;
  }

  const tryResolveByOrg = async (org: Organization, slugForResolve: string) => {
    const member = await resolveMemberProfileForOrganization(user.id, slugForResolve, org);
    return !!(member && roleAllowsOrgAdminArea(member.role as string));
  };

  const slugParam = String(orgSlug ?? "").trim();
  if (slugParam) {
    const org = await fetchActiveOrganizationBySlug(slugParam);
    if (org && (await tryResolveByOrg(org, slugParam))) return true;
  }

  const service = createSupabaseServiceRoleClient();
  const { data: orgRow } = await service
    .from("organizations")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (orgRow) {
    const org = orgRow as Organization;
    const slug = String(org.slug ?? "").trim();
    if (slug && (await tryResolveByOrg(org, slug))) return true;
  }

  const { data: superAdmin } = await supabase.rpc("is_super_admin");
  if (superAdmin === true) return true;

  const { data, error } = await supabase.rpc("is_org_admin", { org_id: id });
  if (!error && typeof data === "boolean" && data) return true;

  const { data: rows } = await service
    .from("profiles")
    .select("id, role, status, organization_id")
    .eq("auth_user_id", user.id);
  const active = (rows ?? []).filter(
    (p) => (p as { status?: string }).status !== "disabled" && p.organization_id
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
    if (String(dataPlaneId) !== id && String(row.id) !== id) continue;
    if (roleAllowsOrgAdminArea(p.role)) return true;
  }

  return false;
}

const PLANNING_CONSOLE_ROLES = new Set<string>(["admin", "owner", "lead", "teamlead", "super_admin"]);

/**
 * Profile row for `/admin/tasks` and `/admin/shifts` gate + org fallback.
 * Uses all memberships: `.single()` on `profiles` fails when a user belongs to multiple orgs,
 * which incorrectly blocked owners/admins.
 */
export async function resolvePlanningConsoleProfile(
  userId: string,
  orgSlug: string | null
): Promise<{ id: string; role: string; organization_id: string } | null> {
  const service = createSupabaseServiceRoleClient();
  const { data: rows } = await service
    .from("profiles")
    .select("id, role, organization_id, status")
    .eq("auth_user_id", userId);
  const active = (rows ?? []).filter((p) => (p as { status?: string }).status !== "disabled") as {
    id: string;
    role: string;
    organization_id: string;
  }[];
  const allowed = active.filter((p) => PLANNING_CONSOLE_ROLES.has(String(p.role)));
  if (allowed.length === 0) return null;
  const slug = String(orgSlug ?? "").trim();
  if (!slug) return allowed[0] ?? null;
  const org = await fetchActiveOrganizationBySlug(slug);
  if (!org) return allowed[0] ?? null;
  const orgIdForData = getOrgIdForData(slug, org.id);
  const match = allowed.find(
    (p) =>
      String(p.organization_id) === String(orgIdForData) || String(p.organization_id) === String(org.id)
  );
  return match ?? allowed[0] ?? null;
}

/**
 * Role in the org from the URL. Pass both data org id and canonical org row id when they can differ (legacy).
 */
export async function getCurrentUserRoleInOrg(
  orgIdForData: string,
  canonicalOrgId?: string | null
): Promise<DbRole | null> {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: rows } = await supabase
    .from("profiles")
    .select("role, organization_id, status")
    .eq("auth_user_id", user.id);
  const cand = new Set(
    [orgIdForData, canonicalOrgId].map((x) => String(x ?? "").trim()).filter(Boolean)
  );
  const prof = (rows ?? []).find(
    (r) =>
      r.organization_id != null &&
      cand.has(String(r.organization_id)) &&
      (r as { status?: string }).status !== "disabled"
  );
  return (prof?.role as DbRole | undefined) ?? null;
}

/**
 * Organisation des eingeloggten Users, nur wenn genau eine aktive Mitgliedschaft existiert.
 * Bei mehreren Orgs (gleiche E-Mail, mehrere Profile) → null — dann /dashboard zur Auswahl nutzen.
 * Liest über Service Role, damit RLS / get_my_organization_id() keine willkürliche „eine Org“ erzwingt.
 */
export async function getCurrentUserOrganization(): Promise<Organization | null> {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const service = createSupabaseServiceRoleClient();
  const { data: profiles } = await service
    .from("profiles")
    .select("organization_id, status")
    .eq("auth_user_id", user.id)
    .neq("status", "disabled");

  const rows = (profiles ?? []).filter((p) => p.organization_id);
  const orgIds = [...new Set(rows.map((p) => String(p.organization_id)))];
  if (orgIds.length !== 1) return null;

  const { data: org } = await service
    .from("organizations")
    .select("*")
    .eq("id", orgIds[0])
    .eq("is_active", true)
    .maybeSingle();

  return (org as Organization) ?? null;
}

/**
 * Plattform-Super-Admin (Developer): `profiles.role = super_admin`, Zugriff plattformweit.
 * Das ist nicht dasselbe wie „Admin einer Organisation“ (`admin` / `owner` in genau dieser Org).
 */
export async function isSuperAdmin(): Promise<boolean> {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data, error } = await supabase.rpc("is_super_admin");
  if (error) {
    console.error("[isSuperAdmin] platform RPC is_super_admin failed (org admins are unaffected)", error);
    return false;
  }
  return data === true;
}

/**
 * Effective role for the org in the URL (handles legacy profile.organization_id ≠ org.id and slug aliases).
 */
export async function getEffectiveUserRoleForOrg(orgSlug: string, org: Organization): Promise<DbRole | null> {
  if (await isSuperAdmin()) return "super_admin";

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const primary = await getCurrentUserRoleInOrg(orgIdForData, org.id);
  if (primary != null) return primary;

  const prof = await resolveMemberProfileForOrganization(user.id, orgSlug, org);
  return (prof?.role as DbRole | undefined) ?? null;
}

/**
 * Wenn der Nutzer genau eine aktive Mitgliedschaft hat: Pfad ins Org-Dashboard.
 * Sonst null (Hub / Auswahl). Nutzung nach Passwort-Login, damit kein Zwischenstop auf /dashboard nötig ist.
 */
export async function getSingleOrgDashboardPathForUserId(userId: string): Promise<string | null> {
  const uid = String(userId ?? "").trim();
  if (!uid) return null;

  const service = createSupabaseServiceRoleClient();
  const { data: profiles } = await service
    .from("profiles")
    .select("organization_id, status")
    .eq("auth_user_id", uid)
    .neq("status", "disabled");

  const rows = (profiles ?? []).filter((p) => p.organization_id);
  const orgIds = [...new Set(rows.map((p) => String(p.organization_id)))];
  if (orgIds.length !== 1) return null;

  const { data: org } = await service
    .from("organizations")
    .select("slug")
    .eq("id", orgIds[0])
    .eq("is_active", true)
    .maybeSingle();

  const slug = String((org as { slug?: string } | null)?.slug ?? "").trim();
  if (!slug) return null;
  return `/${slug}/dashboard`;
}

/**
 * All active organisations the signed-in user has a non-disabled profile in.
 */
export async function getOrganizationsForCurrentUser(): Promise<UserOrgMembership[]> {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.id) return [];

  const service = createSupabaseServiceRoleClient();
  const { data: profiles } = await service
    .from("profiles")
    .select("organization_id, role, status, email")
    .eq("auth_user_id", user.id)
    .neq("status", "disabled");

  const rows = (profiles ?? []).filter((p) => p.organization_id);
  const orgIds = [...new Set(rows.map((p) => String(p.organization_id)))];
  if (orgIds.length === 0) return [];

  const { data: orgs } = await service
    .from("organizations")
    .select("id, slug, name, school_name, school_short")
    .in("id", orgIds)
    .eq("is_active", true);

  const orgById = new Map(
    (orgs ?? []).map((o: { id: string; slug: string; name: string; school_name?: string | null; school_short?: string | null }) => [
      o.id,
      o
    ])
  );

  const byOrg = new Map<string, UserOrgMembership>();
  for (const p of rows) {
    const oid = String(p.organization_id);
    const o = orgById.get(oid);
    if (!o) continue;
    const displayName = String(o.school_short || o.school_name || o.name || "").trim() || o.name;
    if (!byOrg.has(oid)) {
      const pe = (p as { email?: string | null }).email;
      byOrg.set(oid, {
        id: o.id,
        slug: o.slug,
        name: displayName,
        role: (p.role as DbRole | undefined) ?? null,
        profileEmail: typeof pe === "string" && pe.trim() ? pe.trim() : null
      });
    }
  }

  return Array.from(byOrg.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}
