import type { SupabaseClient } from "@supabase/supabase-js";
import { sendShiftAssigned } from "./n8n";

/**
 * Sends an immediate email when a member is assigned to a shift (admin assign or self-claim).
 */
export async function notifyShiftAssignedByEmail(opts: {
  service: SupabaseClient;
  profileId: string;
  shiftId: string;
  orgSlug: string;
}): Promise<void> {
  const { service, profileId, shiftId, orgSlug } = opts;
  if (!orgSlug.trim()) return;

  const [{ data: profile }, { data: shift }] = await Promise.all([
    service.from("profiles").select("full_name, email").eq("id", profileId).maybeSingle(),
    service
      .from("shifts")
      .select("event_name, date, start_time, end_time, location, organization_id")
      .eq("id", shiftId)
      .maybeSingle()
  ]);

  const email = (profile as { email?: string | null } | null)?.email;
  if (!email) return;

  const { data: org } = await service
    .from("organizations")
    .select("name")
    .eq("id", (shift as { organization_id?: string } | null)?.organization_id ?? "")
    .maybeSingle();

  await sendShiftAssigned({
    email,
    fullName: (profile as { full_name?: string | null } | null)?.full_name ?? undefined,
    eventName: (shift as { event_name?: string } | null)?.event_name ?? "Schicht",
    date: (shift as { date?: string } | null)?.date ?? "",
    startTime: (shift as { start_time?: string } | null)?.start_time ?? undefined,
    endTime: (shift as { end_time?: string } | null)?.end_time ?? undefined,
    location: (shift as { location?: string | null } | null)?.location ?? undefined,
    orgName: (org as { name?: string } | null)?.name ?? "OrgFlow",
    orgSlug
  }).catch((err) => console.error("[shift-assigned] n8n failed:", err));
}
