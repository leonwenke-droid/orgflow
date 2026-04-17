import type { SupabaseClient } from "@supabase/supabase-js";

/** Lädt `organizations.slug` für Benachrichtigungen / Links. */
export async function fetchOrgSlugById(
  service: SupabaseClient,
  organizationId: string
): Promise<string | null> {
  const { data } = await service.from("organizations").select("slug").eq("id", organizationId).maybeSingle();
  const s = String((data as { slug?: string | null } | null)?.slug ?? "").trim();
  return s || null;
}

/**
 * Slug aus Formular bevorzugen; wenn leer (z. B. verstecktes Feld fehlt), aus DB nachladen.
 * Ohne Slug sendet `notifyShiftAssignedByEmail` nichts — daher zentral nutzen.
 */
export async function resolveOrgSlugForNotify(
  service: SupabaseClient,
  organizationId: string,
  preferredSlug: string | null | undefined
): Promise<string | null> {
  const t = String(preferredSlug ?? "").trim();
  if (t) return t;
  return fetchOrgSlugById(service, organizationId);
}
