import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { DbRole } from "../types";

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

