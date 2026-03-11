"use server";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData } from "../../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { canAddTeam } from "../../../../lib/planLimits";

export async function createCommitteeAction(
  orgSlug: string,
  name: string
): Promise<{ error: string | null }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: "No permission." };
  const trimmed = (name || "").trim();
  if (!trimmed) return { error: "Name is required." };

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceRoleClient()
    : createServerComponentClient({ cookies });
  const { count } = await supabase
    .from("committees")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgIdForData);
  if (!canAddTeam(org.plan, count ?? 0)) {
    return { error: "Team limit reached for your plan. Upgrade to add more teams." };
  }
  const { error } = await supabase.from("committees").insert({
    name: trimmed,
    organization_id: orgIdForData
  });

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/admin/committees`);
  return { error: null };
}

export async function updateCommitteeNameAction(
  orgSlug: string,
  committeeId: string,
  name: string
): Promise<{ error: string | null }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: "No permission." };
  const trimmed = (name || "").trim();
  if (!trimmed) return { error: "Name is required." };

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceRoleClient()
    : createServerComponentClient({ cookies });
  const { error } = await supabase
    .from("committees")
    .update({ name: trimmed })
    .eq("id", committeeId)
    .eq("organization_id", orgIdForData);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/admin/committees`);
  return { error: null };
}

export async function deleteCommitteeAction(
  orgSlug: string,
  committeeId: string
): Promise<{ error: string | null }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: "No permission." };

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceRoleClient()
    : createServerComponentClient({ cookies });
  const { error } = await supabase
    .from("committees")
    .delete()
    .eq("id", committeeId)
    .eq("organization_id", orgIdForData);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/admin/committees`);
  return { error: null };
}
