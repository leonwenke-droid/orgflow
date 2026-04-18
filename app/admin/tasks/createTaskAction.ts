"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { getCurrentUserOrganization, isOrgAdmin } from "../../../lib/getOrganization";
import { sendTaskAssigned } from "../../../lib/n8n";
import { getPublicOriginSync } from "../../../lib/publicBaseUrl";

export type CreateTaskState = { errorKey?: string; error?: string; success?: boolean } | null;

export async function createTask(_prev: CreateTaskState, formData: FormData): Promise<CreateTaskState> {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.id) return { errorKey: "tasks.not_logged_in" };
  const service = createSupabaseServiceRoleClient();
  const formOrgId = formData.get("organization_id")?.toString().trim() || null;
  const formOrgSlug = formData.get("org_slug")?.toString().trim() || null;

  const { data: profiles } = await service
    .from("profiles")
    .select("id, role, organization_id, status")
    .eq("auth_user_id", user.id)
    .neq("status", "disabled");

  const profile =
    (formOrgId ? (profiles ?? []).find((p: any) => String(p.organization_id ?? "") === formOrgId) : null) ??
    ((profiles ?? []).length === 1 ? (profiles ?? [])[0] : null);

  if (!profile || !["admin", "lead", "teamlead", "super_admin", "owner"].includes((profile as any).role)) {
    return { errorKey: "tasks.not_authorized" };
  }

  const title = formData.get("title")?.toString().trim();
  const description = formData.get("description")?.toString().trim() || null;
  const committeeId = formData.get("committee_id")?.toString() || null;
  const ownerId = formData.get("owner_id")?.toString() || null;
  const ownerScope = formData.get("owner_scope")?.toString() === "committee" ? "committee" : "year";
  const dueAt = formData.get("due_at")?.toString() || null;
  const proofRequired = formData.get("proof_required") === "on";
  const eventId = formData.get("event_id")?.toString().trim() || null;
  const claimable = formData.get("claimable") === "on";
  const modal = formData.get("modal") === "1";

  if (!title) {
    return { errorKey: "tasks.title_required" };
  }

  if (dueAt && new Date(dueAt).getTime() < Date.now()) {
    return { errorKey: "tasks.deadline_past" };
  }
  if (ownerScope === "committee" && !committeeId) {
    return { errorKey: "tasks.committee_required_for_scope" };
  }
  if (!ownerId && !claimable) {
    return { errorKey: "tasks.owner_or_claimable_required" };
  }

  const token = crypto.randomUUID().replace(/-/g, "");
  let orgIdForInsert: string | null = null;
  if (formOrgId) {
    if (!(await isOrgAdmin(formOrgId, formOrgSlug))) {
      return { errorKey: "tasks.not_authorized" };
    }
    orgIdForInsert = formOrgId;
  } else {
    const fromProfile = (profile as { organization_id?: string | null }).organization_id ?? null;
    if (fromProfile && (await isOrgAdmin(fromProfile, formOrgSlug))) {
      orgIdForInsert = fromProfile;
    }
  }
  if (!orgIdForInsert) {
    return { errorKey: "tasks.no_organization" };
  }

  const { data: insertedTask, error } = await service
    .from("tasks")
    .insert({
    title,
    description,
    committee_id: committeeId || null,
    owner_id: ownerId || null,
    claimable: !ownerId ? true : claimable,
    created_by: profile.id,
    due_at: dueAt ? new Date(dueAt).toISOString() : null,
    proof_required: proofRequired,
    access_token: token,
    ...(eventId ? { event_id: eventId } : {}),
    organization_id: orgIdForInsert
    })
    .select("id, title, description, due_at, owner_id")
    .maybeSingle();

  if (error) {
    console.error(error);
    return { errorKey: "tasks.create_error" };
  }

  // Bei Zuweisung: Mitglied per E-Mail benachrichtigen.
  if (ownerId) {
    const [{ data: assignedProfile }, { data: orgRow }] = await Promise.all([
      service.from("profiles").select("email, full_name").eq("id", ownerId).maybeSingle(),
      service.from("organizations").select("name, slug").eq("id", orgIdForInsert).maybeSingle()
    ]);
    const em = (assignedProfile as { email?: string | null } | null)?.email;
    const orgSlugResolved = String((orgRow as { slug?: string | null } | null)?.slug ?? "").trim();
    if (em && orgSlugResolved) {
      const base = getPublicOriginSync();
      const taskUrl = `${base}/${orgSlugResolved}/tasks`;
      void sendTaskAssigned({
        email: em,
        fullName: (assignedProfile as { full_name?: string | null } | null)?.full_name ?? undefined,
        taskTitle: String((insertedTask as { title?: string } | null)?.title ?? title ?? "Task"),
        description: (insertedTask as { description?: string | null } | null)?.description ?? description ?? undefined,
        dueAt: (insertedTask as { due_at?: string | null } | null)?.due_at
          ? new Date(String((insertedTask as { due_at: string }).due_at)).toLocaleString("de-DE", {
              dateStyle: "medium",
              timeStyle: "short"
            })
          : undefined,
        orgName: String((orgRow as { name?: string | null } | null)?.name ?? "OrgFlow"),
        orgSlug: orgSlugResolved,
        taskUrl
      }).catch(() => {});
    }
  }

  if (modal) {
    revalidatePath("/admin/tasks");
    if (formOrgSlug) {
      revalidatePath(`/admin/tasks?org=${encodeURIComponent(formOrgSlug)}`);
    }
    return { success: true };
  }

  if (formOrgSlug) {
    redirect(`/admin/tasks?org=${encodeURIComponent(formOrgSlug)}`);
  }
  const org = await getCurrentUserOrganization();
  redirect(org?.slug ? `/admin/tasks?org=${encodeURIComponent(org.slug)}` : "/admin/tasks");
}
