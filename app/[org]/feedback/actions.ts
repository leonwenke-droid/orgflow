"use server";

import { revalidatePath } from "next/cache";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import {
  getCurrentOrganization,
  isSuperAdmin,
  resolveMemberProfileForOrganization
} from "../../../lib/getOrganization";
import { sendSupportRequest } from "../../../lib/n8n";

export async function submitMemberFeatureRequest(
  orgSlug: string,
  _prev: { ok?: boolean; errorKey?: string } | undefined,
  formData: FormData
): Promise<{ ok?: boolean; errorKey?: string }> {
  const slug = String(orgSlug ?? "").trim();
  const titleRaw = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!slug || !titleRaw) return { errorKey: "feedback.error_title" };

  const prefix =
    type === "bug" ? "[Bug] " : type === "idea" ? "[Idea] " : type === "question" ? "[Question] " : "";
  const title = `${prefix}${titleRaw}`.trim();

  const org = await getCurrentOrganization(slug);

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.id) return { errorKey: "feedback.error_sign_in" };

  const superUser = await isSuperAdmin();
  const prof = superUser
    ? null
    : await resolveMemberProfileForOrganization(user.id, slug, org);

  if (!superUser && !prof?.id) {
    return { errorKey: "feedback.error_not_member" };
  }

  const organizationId = prof?.organization_id ?? org.id;
  const { error } = await supabase.from("feature_requests").insert({
    organization_id: organizationId,
    created_by: (prof?.id as string | undefined) ?? null,
    title,
    description,
    status: "new"
  });

  if (error) return { errorKey: "feedback.error_save" };

  const supportType =
    type === "bug" ? "bug" : type === "question" ? "question" : "idea";
  void sendSupportRequest({
    email: user.email ?? "",
    name: (prof as { full_name?: string | null } | null)?.full_name ?? undefined,
    type: supportType,
    subject: title,
    message: description ?? title,
    orgName: org.name,
    orgSlug: slug
  }).catch((err) => console.error("[feedback] n8n support failed:", err));

  revalidatePath(`/${slug}/feedback`);
  return { ok: true };
}
