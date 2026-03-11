"use server";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { isSuperAdmin } from "../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../lib/supabaseServer";

export async function deleteOrganizationAction(
  orgId: string,
  orgName: string,
  confirmation: string
): Promise<{ error: string | null }> {
  if (!(await isSuperAdmin())) {
    return { error: "Keine Berechtigung." };
  }
  const trimmed = (confirmation || "").trim();
  const expectedName = (orgName || "").trim();
  if (trimmed !== expectedName) {
    return { error: "Der eingegebene Name stimmt nicht mit dem Organisationsnamen überein." };
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from("organizations").delete().eq("id", orgId);

  if (error) return { error: error.message };
  revalidatePath("/super-admin");
  return { error: null };
}

/**
 * Erzeugt einen neuen Einrichtungs-Token für eine Organisation, die noch nicht eingerichtet wurde.
 * Nur wenn setup_token_used_at null ist.
 */
export async function regenerateSetupTokenAction(
  orgId: string
): Promise<{ error: string | null; token?: string; slug?: string }> {
  if (!(await isSuperAdmin())) {
    return { error: "Keine Berechtigung." };
  }

  const supabase = createServerComponentClient({ cookies });
  const { data: org, error: fetchErr } = await supabase
    .from("organizations")
    .select("id, slug, setup_token_used_at")
    .eq("id", orgId)
    .single();

  if (fetchErr || !org) return { error: "Organisation nicht gefunden." };
  if ((org as { setup_token_used_at?: string | null }).setup_token_used_at) {
    return { error: "Einrichtungs-Link wurde bereits genutzt. Kein neuer Token möglich." };
  }

  const newToken = randomUUID();
  const { error: updateErr } = await supabase
    .from("organizations")
    .update({ setup_token: newToken })
    .eq("id", orgId);

  if (updateErr) return { error: updateErr.message };
  revalidatePath("/super-admin");
  return { error: null, token: newToken, slug: (org as { slug: string }).slug };
}
