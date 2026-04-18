"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentOrganization } from "../../../lib/getOrganization";
import { assertCanChangeOrgSettings } from "../../../lib/permissionsServer";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";

export async function updateOrganizationAction(
  orgSlug: string,
  payload: { name?: string; slug?: string; logoUrl?: string | null }
): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  if (!(await assertCanChangeOrgSettings(orgSlug, org))) {
    return { error: "Not authorized to update this organization." };
  }

  const updates: { name?: string; settings?: Record<string, unknown> } = {};
  if (payload.name != null) {
    const name = String(payload.name).trim();
    if (!name) return { error: "Name is required." };
    updates.name = name;
  }
  // URL-Slug kann nach Erstellung nur vom Support geändert werden.
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

  revalidateTag("organizations");
  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/settings`);
  revalidatePath(`/${orgSlug}/admin`);

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

    revalidateTag("organizations");
    revalidatePath(`/${orgSlug}/settings`);
  }

  return { url: publicUrl };
}

export async function updateOrganizationCurrencyAction(
  orgSlug: string,
  currencyRaw: string
): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  if (!(await assertCanChangeOrgSettings(orgSlug, org))) {
    return { error: "Not authorized." };
  }

  const code = String(currencyRaw ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    return { error: "Use a 3-letter ISO 4217 code (e.g. EUR, USD, GBP)." };
  }

  const prev = { ...(org.settings as Record<string, unknown>) };
  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("organizations")
    .update({ settings: { ...prev, currency: code } })
    .eq("id", org.id);

  if (error) return { error: error.message };
  revalidateTag("organizations");
  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/settings`);
  revalidatePath(`/${orgSlug}/admin`);
  return {};
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
    const triedPaidOnly =
      features.engagement_tracking === true ||
      features.treasury === true ||
      features.resources === true ||
      features.materials === true ||
      features.events === true;
    if (triedPaidOnly) {
      return { errorKey: "settings.paid_module_requires_paid" };
    }
    next.engagement_tracking = false;
    next.treasury = false;
    next.resources = false;
    next.materials = false;
    next.events = false;
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("organizations")
    .update({ settings: { ...(org.settings as object), features: next } })
    .eq("id", org.id);

  if (error) return { error: error.message };
  revalidateTag("organizations");
  revalidatePath(`/${orgSlug}`);
  revalidatePath(`/${orgSlug}/settings`);
  revalidatePath(`/${orgSlug}/admin`);
  return {};
}
