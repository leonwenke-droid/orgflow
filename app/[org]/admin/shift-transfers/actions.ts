"use server";

import { revalidatePath } from "next/cache";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { requireOrgAdminAction } from "../../../../lib/permissionsServer";
import { getCurrentOrganization, getOrgIdForData } from "../../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { createUserNotification } from "../../../../lib/notifications";

async function notifyRequester(orgSlug: string, requestId: string, kind: "approved" | "rejected") {
  const service = createSupabaseServiceRoleClient();
  const { data: req } = await service
    .from("shift_transfer_requests")
    .select("id, from_user_id, organization_id, shift_assignments(shift_id, shifts(event_name))")
    .eq("id", requestId)
    .maybeSingle();
  const fromId = (req as any)?.from_user_id as string | undefined;
  const orgId = (req as any)?.organization_id as string | undefined;
  const evName = (req as any)?.shift_assignments?.shifts?.event_name ?? "Shift";
  if (!fromId || !orgId) return;
  await createUserNotification(service, {
    profileId: fromId,
    organizationId: orgId,
    type: kind === "approved" ? "shift_transfer_approved" : "shift_transfer_rejected",
    title: kind === "approved" ? "Übergabe genehmigt" : "Übergabe abgelehnt",
    body:
      kind === "approved"
        ? `Deine Übergabe-Anfrage für „${evName}“ wurde genehmigt. Die Schicht ist jetzt übernehmbar.`
        : `Deine Übergabe-Anfrage für „${evName}“ wurde abgelehnt.`,
    link: `/${orgSlug}/shifts`
  }).catch(() => {});
}

export async function approveShiftTransferAction(orgSlug: string, requestId: string): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const actor = await requireOrgAdminAction(orgIdForData, orgSlug);
  if (!actor) return { error: "Not authorized." };

  const supabase = createServerComponentClient({ cookies });
  const { error } = await supabase.rpc("approve_shift_transfer", { p_request_id: requestId });
  if (error) return { error: error.message };

  await notifyRequester(orgSlug, requestId, "approved");
  revalidatePath(`/${orgSlug}/admin/shift-transfers`);
  revalidatePath(`/${orgSlug}/shifts`);
  revalidatePath(`/${orgSlug}/dashboard`);
  return {};
}

export async function rejectShiftTransferAction(orgSlug: string, requestId: string): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const actor = await requireOrgAdminAction(orgIdForData, orgSlug);
  if (!actor) return { error: "Not authorized." };

  const supabase = createServerComponentClient({ cookies });
  const { error } = await supabase.rpc("reject_shift_transfer", { p_request_id: requestId });
  if (error) return { error: error.message };

  await notifyRequester(orgSlug, requestId, "rejected");
  revalidatePath(`/${orgSlug}/admin/shift-transfers`);
  revalidatePath(`/${orgSlug}/shifts`);
  revalidatePath(`/${orgSlug}/dashboard`);
  return {};
}

