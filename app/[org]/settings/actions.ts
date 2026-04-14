"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentOrganization } from "../../../lib/getOrganization";
import { assertCanChangeOrgSettings } from "../../../lib/permissionsServer";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function updateOrganizationAction(
  orgSlug: string,
  payload: { name?: string; slug?: string; logoUrl?: string | null }
): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  if (!(await assertCanChangeOrgSettings(orgSlug, org))) {
    return { error: "Not authorized to update this organization." };
  }

  const updates: { name?: string; slug?: string; settings?: Record<string, unknown> } = {};
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
  if (payload.logoUrl !== undefined) {
    const prev = { ...(org.settings as Record<string, unknown>) };
    const branding = { ...((prev.branding as Record<string, unknown>) ?? {}) };
    const u = String(payload.logoUrl ?? "").trim();
    if (u) branding.logo_url = u;
    else delete branding.logo_url;
    updates.settings = { ...prev, branding };
  }

  if (Object.keys(updates).length === 0) {
    return {};
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from("organizations").update(updates).eq("id", org.id);

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

export async function uploadOrgLogoAction(
  orgSlug: string,
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  if (!(await assertCanChangeOrgSettings(orgSlug, org))) {
    return { error: "Not authorized." };
  }

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) return { error: "No file provided." };
  if (file.size > 2 * 1024 * 1024) return { error: "File too large (max 2 MB)." };

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) return { error: "Only JPEG, PNG, or WebP." };

  const ext = file.name.split(".").pop() ?? "png";
  const path = `org-logos/${org.id}/logo.${ext}`;

  const service = createSupabaseServiceRoleClient();

  const { error: uploadErr } = await service.storage
    .from("public")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadErr) return { error: uploadErr.message };

  const { data: urlData } = service.storage.from("public").getPublicUrl(path);
  const publicUrl = urlData?.publicUrl;

  if (publicUrl) {
    const prev = { ...(org.settings as Record<string, unknown>) };
    const branding = { ...((prev.branding as Record<string, unknown>) ?? {}) };
    branding.logo_url = publicUrl;
    await service
      .from("organizations")
      .update({ settings: { ...prev, branding } })
      .eq("id", org.id);

    revalidatePath(`/${orgSlug}/settings`);
  }

  return { url: publicUrl };
}

export type FeaturesMap = Record<string, boolean>;

export async function updateOrgFeaturesAction(
  orgSlug: string,
  features: Partial<FeaturesMap>
): Promise<{ error?: string; errorKey?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  if (!(await assertCanChangeOrgSettings(orgSlug, org))) {
    return { error: "Not authorized.", errorKey: "common.unauthorized" };
  }

  const current = (org.settings as { features?: FeaturesMap })?.features ?? {};
  const next: FeaturesMap = { ...current };
  for (const [k, v] of Object.entries(features)) {
    if (typeof v === "boolean") next[k] = v;
  }

  const plan = String((org as { plan?: string }).plan ?? "free").trim();
  if (plan === "free") {
    if (features.engagement_tracking === true) {
      return { errorKey: "settings.engagement_requires_paid" };
    }
    next.engagement_tracking = false;
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("organizations")
    .update({ settings: { ...(org.settings as object), features: next } })
    .eq("id", org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/settings`);
  revalidatePath(`/${orgSlug}/admin`);
  return {};
}
