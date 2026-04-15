"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { memberUnavailabilityRangeToIso } from "../../../lib/berlinCalendarRange";

async function resolveMyProfileId(orgSlug: string, orgId: string, orgIdForData: string) {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;
  const service = createSupabaseServiceRoleClient();
  const { data: primary } = await service
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();
  if (primary?.id) return primary.id as string;
  const { data: fallback } = await service
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  return (fallback?.id as string) ?? null;
}


/** Legacy single-range submit — creates one pending request. */
export async function addMemberUnavailabilityAction(
  orgSlug: string,
  formData: FormData
): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const profileId = await resolveMyProfileId(orgSlug, org.id, orgIdForData);
  if (!profileId) return { error: "not_signed_in" };

  const fromStr = String(formData.get("unavailable_from") ?? "").trim();
  const untilStr = String(formData.get("unavailable_until") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!fromStr || !untilStr) return { error: "dates_required" };

  const iso = memberUnavailabilityRangeToIso(fromStr, untilStr);
  if (!iso) return { error: "invalid_range" };

  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from("member_unavailability").insert({
    user_id: profileId,
    organization_id: org.id,
    unavailable_from: iso.unavailable_from,
    unavailable_until: iso.unavailable_until,
    reason,
    status: "pending"
  });

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/me`);
  revalidatePath(`/${orgSlug}/account`);
  return {};
}

export type UnavailabilityRangeYmd = { from: string; until: string };

/** Calendar planner: multiple contiguous ranges → pending rows (one DB row per range). */
export async function submitMemberUnavailabilityRangesAction(
  orgSlug: string,
  ranges: UnavailabilityRangeYmd[],
  reason: string | null
): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const profileId = await resolveMyProfileId(orgSlug, org.id, orgIdForData);
  if (!profileId) return { error: "not_signed_in" };

  const clean = (ranges ?? []).filter((r) => r.from && r.until);
  if (clean.length === 0) return { error: "dates_required" };

  const rows: {
    user_id: string;
    organization_id: string;
    unavailable_from: string;
    unavailable_until: string;
    reason: string | null;
    status: string;
  }[] = [];

  for (const r of clean) {
    const iso = memberUnavailabilityRangeToIso(r.from.trim(), r.until.trim());
    if (!iso) return { error: "invalid_range" };
    rows.push({
      user_id: profileId,
      organization_id: org.id,
      unavailable_from: iso.unavailable_from,
      unavailable_until: iso.unavailable_until,
      reason: reason?.trim() || null,
      status: "pending"
    });
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from("member_unavailability").insert(rows);
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/me`);
  revalidatePath(`/${orgSlug}/account`);
  revalidatePath(`/${orgSlug}/admin/unavailability`);
  return {};
}

export async function deleteMemberUnavailabilityAction(
  orgSlug: string,
  id: string
): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const profileId = await resolveMyProfileId(orgSlug, org.id, orgIdForData);
  if (!profileId) return { error: "not_signed_in" };

  const service = createSupabaseServiceRoleClient();
  const { data: row } = await service
    .from("member_unavailability")
    .select("id, user_id")
    .eq("id", id)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!row || (row as { user_id: string }).user_id !== profileId) {
    return { error: "not_found" };
  }

  const { error } = await service.from("member_unavailability").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/me`);
  revalidatePath(`/${orgSlug}/account`);
  revalidatePath(`/${orgSlug}/admin/unavailability`);
  return {};
}
