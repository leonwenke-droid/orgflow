import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

/** Feste Org-ID für den Jahrgang TGG (alle Profile/Scores haben organization_id = diese ID). */
export const TGG_ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const TGG_SLUGS = ["abi-2026-tgg", "abi2026-tgg"];

/**
 * Für Slug abi-2026-tgg/abi2026-tgg wird immer TGG_ORG_ID verwendet (Profile haben bereits diese organization_id).
 * Sonst die übergebene orgId (aus getCurrentOrganization).
 */
export function getOrgIdForData(orgSlug: string, orgId: string): string {
  const slug = String(orgSlug || "").trim();
  return TGG_SLUGS.includes(slug) ? TGG_ORG_ID : orgId;
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
  settings: {
    currency?: string;
    timezone?: string;
    features?: Record<string, boolean>;
    engagement_weights?: Record<string, number>;
    contact_email?: string;
    contact_phone?: string;
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

  const { data: org, error } = await supabase
    .from("organizations")
    .select("*")
    .or(`slug.eq.${quoted},subdomain.eq.${quoted}`)
    .eq("is_active", true)
    .single();

  if (error || !org) {
    notFound();
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
    .select("role, organization_id")
    .eq("auth_user_id", user.id)
    .single();

  return (
    profile?.role === "super_admin" ||
    ((profile?.role === "admin" || profile?.role === "lead") &&
      profile?.organization_id === orgId)
  );
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
      .select("organization_id")
      .eq("auth_user_id", user.id)
      .single();
    if (!profile?.organization_id) return null;
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .eq("is_active", true)
      .single();
    return (org as Organization) ?? null;
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .eq("is_active", true)
    .single();

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

