"use server";

import { revalidatePath } from "next/cache";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { requireOrgAdminAction } from "../../../../lib/permissionsServer";
import { getCurrentOrganization, getOrgIdForData } from "../../../../lib/getOrganization";

export async function approveTransferAction(
  orgSlug: string,
  requestId: string
): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const actor = await requireOrgAdminAction(orgIdForData, orgSlug);
  if (!actor) return { error: "Not authorized." };

  const supabase = createServerComponentClient({ cookies });
  const { error } = await supabase.rpc("approve_task_transfer", {
    p_request_id: requestId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/admin/transfers`);
  revalidatePath(`/${orgSlug}/tasks`);
  revalidatePath(`/${orgSlug}/dashboard`);
  return {};
}

export async function rejectTransferAction(
  orgSlug: string,
  requestId: string
): Promise<{ error?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  const actor = await requireOrgAdminAction(orgIdForData, orgSlug);
  if (!actor) return { error: "Not authorized." };

  const supabase = createServerComponentClient({ cookies });
  const { error } = await supabase.rpc("reject_task_transfer", {
    p_request_id: requestId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/admin/transfers`);
  revalidatePath(`/${orgSlug}/tasks`);
  revalidatePath(`/${orgSlug}/dashboard`);
  return {};
}
