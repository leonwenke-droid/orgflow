"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";

async function resolveMyProfileId(orgSlug: string, orgId: string, orgIdForData: string) {
  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
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

  const unavailable_from = new Date(fromStr + "T12:00:00.000Z").toISOString();
  const unavailable_until = new Date(untilStr + "T23:59:59.999Z").toISOString();

  if (unavailable_until <= unavailable_from) {
    return { error: "invalid_range" };
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from("member_unavailability").insert({
    user_id: profileId,
    organization_id: org.id,
    unavailable_from,
    unavailable_until,
    reason
  });

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/me`);
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
  return {};
}
