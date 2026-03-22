"use server";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData } from "../../../../lib/getOrganization";
import { canAddTeam } from "../../../../lib/planLimits";

function normName(s: string) {
  return s.trim().toLowerCase();
}

async function duplicateNameInOrg(
  supabase: ReturnType<typeof createServerComponentClient>,
  orgId: string,
  name: string,
  exceptCommitteeId?: string
): Promise<boolean> {
  const { data } = await supabase.from("committees").select("id, name").eq("organization_id", orgId);
  const want = normName(name);
  if (!want) return false;
  return (data ?? []).some((c: { id: string; name: string }) => {
    if (exceptCommitteeId && c.id === exceptCommitteeId) return false;
    return normName(c.name) === want;
  });
}

export async function createCommitteeAction(
  orgSlug: string,
  payload: { name: string; description?: string | null; is_active?: boolean }
): Promise<{ error: string | null; errorKey?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: null, errorKey: "common.unauthorized" };
  const trimmed = (payload.name || "").trim();
  if (!trimmed) return { error: null, errorKey: "members.error_name_required" };

  const supabase = createServerComponentClient({ cookies });
  if (await duplicateNameInOrg(supabase, orgIdForData, trimmed)) {
    return { error: null, errorKey: "teams.duplicate_name" };
  }

  const { count } = await supabase
    .from("committees")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgIdForData);
  if (!canAddTeam(org.plan, count ?? 0)) {
    return { error: "Team limit reached for your plan. Upgrade to Team or Pro to add more teams." };
  }

  const description =
    typeof payload.description === "string" && payload.description.trim()
      ? payload.description.trim()
      : null;
  const isActive = payload.is_active !== false;

  const { error } = await supabase.from("committees").insert({
    name: trimmed,
    description,
    is_active: isActive,
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
): Promise<{ error: string | null; errorKey?: string }> {
  return updateCommitteeAction(orgSlug, committeeId, { name });
}

export async function updateCommitteeAction(
  orgSlug: string,
  committeeId: string,
  fields: {
    name: string;
    description?: string | null;
    is_active?: boolean;
  }
): Promise<{ error: string | null; errorKey?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: null, errorKey: "common.unauthorized" };
  const trimmed = (fields.name || "").trim();
  if (!trimmed) return { error: null, errorKey: "members.error_name_required" };

  const supabase = createServerComponentClient({ cookies });
  if (await duplicateNameInOrg(supabase, orgIdForData, trimmed, committeeId)) {
    return { error: null, errorKey: "teams.duplicate_name" };
  }

  const description =
    fields.description === undefined
      ? undefined
      : typeof fields.description === "string" && fields.description.trim()
        ? fields.description.trim()
        : null;

  const patch: Record<string, unknown> = { name: trimmed };
  if (description !== undefined) patch.description = description;
  if (typeof fields.is_active === "boolean") patch.is_active = fields.is_active;

  const { error } = await supabase
    .from("committees")
    .update(patch)
    .eq("id", committeeId)
    .eq("organization_id", orgIdForData);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/admin/committees`);
  return { error: null };
}

export async function deleteCommitteeAction(
  orgSlug: string,
  committeeId: string
): Promise<{ error: string | null; errorKey?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: null, errorKey: "common.unauthorized" };

  const supabase = createServerComponentClient({ cookies });
  const { error } = await supabase
    .from("committees")
    .delete()
    .eq("id", committeeId)
    .eq("organization_id", orgIdForData);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/admin/committees`);
  return { error: null };
}
