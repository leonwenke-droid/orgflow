"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";

const STATUSES = new Set(["offen", "in_arbeit", "erledigt"]);

export async function updateTaskKanbanStatus(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  const orgSlug = String(formData.get("org_slug") ?? "").trim();
  if (!taskId || !status || !organizationId || !STATUSES.has(status)) return;

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: ok } = await supabase.rpc("is_org_admin", { org_id: organizationId });
  if (ok !== true) return;

  const service = createSupabaseServiceRoleClient();
  await service.from("tasks").update({ status }).eq("id", taskId).eq("organization_id", organizationId);

  revalidatePath("/admin/tasks");
  if (orgSlug) revalidatePath(`/admin/tasks?org=${encodeURIComponent(orgSlug)}`);
}

export async function deleteTask(formData: FormData) {
  const taskId = formData.get("taskId")?.toString();
  if (!taskId) return;
  const service = createSupabaseServiceRoleClient();
  await service.from("tasks").delete().eq("id", taskId);
  revalidatePath("/admin/tasks");
}
