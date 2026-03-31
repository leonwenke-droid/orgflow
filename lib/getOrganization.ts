import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { DbRole } from "../types";
import { createSupabaseServiceRoleClient } from "./supabaseServer";

/** Organisations the current user belongs to (for /dashboard hub). */
export type UserOrgMembership = {
  id: string;
  slug: string;
  name: string;
  role: DbRole | null;
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
 * Holt Organization basierend auf Slug ODER Subdomain
 * (wird später von org-spezifischen Routen und Landingpage genutzt).
 */
export async function getCurrentOrganization(
  slugOrSubdomain: string
): Promise<Organization> {
  const supabase = createServerComponentClient({ cookies });
  const value = String(slugOrSubdomain).trim();
  const quoted = `"${value.replace(/"/g, '""')}"`;

  let { data: org, error } = await supabase
    .from("organizations")
    .select("*")
    .or(`slug.eq.${quoted},subdomain.eq.${quoted}`)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    notFound();
  }

  if (!org) {
    const { data: aliasRows, error: aliasError } = await supabase
      .from("organizations")
      .select("*")
      .eq("is_active", true)
      .contains("slug_aliases", [value]);

    if (aliasError || !aliasRows?.length) {
      notFound();
    }
    if (aliasRows.length !== 1) {
      notFound();
    }
    org = aliasRows[0];
  }

  const o = org as Organization;
  if (typeof o.name === "string") o.name = o.name.trim();
  return o;
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

/**
 * Prüft, ob der aktuelle User Admin/Lead dieser Organisation ist (oder Super-Admin).
 * Nutzt RPC is_org_admin(org_id), um RLS beim Profil-Lesen zu umgehen.
 * Super-Admin hat immer Zugriff auf jedes Org-Admin.
 */
export async function isOrgAdmin(orgId: string): Promise<boolean> {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data: superAdmin } = await supabase.rpc("is_super_admin");
  if (superAdmin === true) return true;

  const { data, error } = await supabase.rpc("is_org_admin", { org_id: orgId });
  if (!error && typeof data === "boolean") return data;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id, status")
    .eq("auth_user_id", user.id)
    .single();

  return (
    profile?.status !== "disabled" &&
    (profile?.role === "super_admin" ||
      ((profile?.role === "admin" || profile?.role === "lead" || profile?.role === "owner") &&
        profile?.organization_id === orgId))
  );
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
 * Holt die Organisation des aktuell eingeloggten Users (für Redirect von /dashboard, /admin).
 * Nutzt RPC get_my_organization_id(), um RLS-Rekursion beim Profil-Lesen zu umgehen.
 */
export async function getCurrentUserOrganization(): Promise<Organization | null> {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: orgId, error: rpcError } = await supabase.rpc("get_my_organization_id");

  if (rpcError || !orgId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, status")
      .eq("auth_user_id", user.id)
      .single();
    if (!profile?.organization_id || profile.status === "disabled") return null;
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .eq("is_active", true)
      .maybeSingle();
    return (org as Organization) ?? null;
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .eq("is_active", true)
    .maybeSingle();

  return (org as Organization) ?? null;
}

/**
 * Prüft, ob der aktuelle User Super-Admin ist.
 */
export async function isSuperAdmin(): Promise<boolean> {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data, error } = await supabase.rpc("is_super_admin");
  if (error) {
    console.error("[isSuperAdmin] rpc error", error);
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
    .select("organization_id, role, status")
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
      byOrg.set(oid, {
        id: o.id,
        slug: o.slug,
        name: displayName,
        role: (p.role as DbRole | undefined) ?? null
      });
    }
  }

  return Array.from(byOrg.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}
