import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserNotification } from "./notifications";
import { notifyShiftAssignedByEmail } from "./shiftAssignmentNotifications";

const ADMIN_NOTIFY_ROLES = ["admin", "owner", "lead", "super_admin"] as const;

/**
 * After a member self-claims a shift: notify the member and all org admins (except the claimer).
 */
export async function notifyAfterShiftSelfClaim(opts: {
  service: SupabaseClient;
  organizationId: string;
  claimerProfileId: string;
  orgSlug: string;
  shiftId: string;
}): Promise<void> {
  const { service, organizationId, claimerProfileId, orgSlug, shiftId } = opts;

  const { data: shift } = await service.from("shifts").select("event_name").eq("id", shiftId).maybeSingle();
  const eventLabel = String((shift as { event_name?: string } | null)?.event_name ?? "").trim() || "Shift";

  const { data: claimer } = await service.from("profiles").select("full_name").eq("id", claimerProfileId).maybeSingle();
  const claimerName = String((claimer as { full_name?: string } | null)?.full_name ?? "").trim() || "A member";

  await createUserNotification(service, {
    profileId: claimerProfileId,
    organizationId,
    type: "shift_self_claimed",
    title: "Schicht übernommen",
    body: `Du hast dich für „${eventLabel}“ eingetragen.`,
    link: `/${orgSlug}/shifts`
  });

  await notifyShiftAssignedByEmail({
    service,
    profileId: claimerProfileId,
    shiftId,
    orgSlug
  }).catch(() => {});

  const { data: admins } = await service
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .in("role", [...ADMIN_NOTIFY_ROLES])
    .neq("status", "disabled");

  for (const row of admins ?? []) {
    const id = (row as { id: string }).id;
    if (id === claimerProfileId) continue;
    await createUserNotification(service, {
      profileId: id,
      organizationId,
      type: "shift_member_joined",
      title: "Neue Schicht-Meldung",
      body: `${claimerName} hat sich für „${eventLabel}“ eingetragen.`,
      link: `/${orgSlug}/admin/shifts`
    });
  }
}
