"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentOrganization, isOrgAdmin } from "../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function updateOrganizationAction(
  orgSlug: string,
  payload: { name?: string; slug?: string }
): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  if (!(await isOrgAdmin(org.id))) {
    return { error: "Not authorized to update this organization." };
  }

  const updates: { name?: string; slug?: string } = {};
  if (payload.name != null) {
    const name = String(payload.name).trim();
    if (!name) return { error: "Name is required." };
    updates.name = name;
  }
  if (payload.slug != null) {
    const slug = String(payload.slug).trim().toLowerCase();
    if (!slug) return { error: "Slug is required." };
    if (!SLUG_REGEX.test(slug)) {
      return { error: "Slug may only contain lowercase letters, numbers and hyphens." };
    }
    if (slug !== org.slug) {
      const service = createSupabaseServiceRoleClient();
      const { data: existing } = await service
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (existing) return { error: "This slug is already in use." };
      updates.slug = slug;
    }
  }

  if (Object.keys(updates).length === 0) {
    return {};
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("organizations")
    .update(updates)
    .eq("id", org.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/settings`);
  revalidatePath(`/${orgSlug}/admin`);

  if (updates.slug) {
    redirect(`/${updates.slug}/settings`);
  }
  return {};
}
