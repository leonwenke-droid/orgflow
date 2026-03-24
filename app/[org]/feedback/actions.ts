"use server";

import { revalidatePath } from "next/cache";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentOrganization, getOrgIdForData } from "../../../lib/getOrganization";

export async function submitMemberFeatureRequest(
  orgSlug: string,
  _prev: { ok?: boolean; errorKey?: string } | undefined,
  formData: FormData
): Promise<{ ok?: boolean; errorKey?: string }> {
  const slug = String(orgSlug ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!slug || !title) return { errorKey: "feedback.error_title" };

  const org = await getCurrentOrganization(slug);
  const orgIdForData = getOrgIdForData(slug, org.id);

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.id) return { errorKey: "feedback.error_sign_in" };

  const { data: prof } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();

  if (!prof?.id || (prof as { status?: string }).status === "disabled") {
    return { errorKey: "feedback.error_not_member" };
  }

  const { error } = await supabase.from("feature_requests").insert({
    organization_id: orgIdForData,
    created_by: prof.id as string,
    title,
    description,
    status: "new"
  });

  if (error) return { errorKey: "feedback.error_save" };

  revalidatePath(`/${slug}/feedback`);
  return { ok: true };
}
