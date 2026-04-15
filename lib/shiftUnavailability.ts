import type { createSupabaseServiceRoleClient } from "./supabaseServer";

type ServiceClient = ReturnType<typeof createSupabaseServiceRoleClient>;

/**
 * Profile IDs (subset of `profileIds`) with **approved** `member_unavailability`
 * overlapping the shift window (`rotation_shift_window`), same rules as rotation RPCs.
 */
export async function getProfileIdsBlockedByApprovedUnavailability(
  service: ServiceClient,
  shiftId: string,
  profileIds: string[]
): Promise<Set<string>> {
  const ids = profileIds.filter(Boolean);
  if (ids.length === 0) return new Set();

  const { data, error } = await service.rpc("profiles_blocked_by_unavailability_for_shift", {
    p_shift_id: shiftId,
    p_profile_ids: ids
  });

  if (error) {
    console.error("[profiles_blocked_by_unavailability_for_shift]", error.message);
    return new Set(ids);
  }

  const blocked = (data as string[] | null) ?? [];
  return new Set(blocked);
}

export async function isProfileBlockedByApprovedUnavailability(
  service: ServiceClient,
  shiftId: string,
  profileId: string
): Promise<boolean> {
  const s = await getProfileIdsBlockedByApprovedUnavailability(service, shiftId, [profileId]);
  return s.has(profileId);
}
