"use server";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect as serverRedirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function claimTaskAction(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const taskId = String(formData.get("taskId") ?? "").trim();
  if (!orgSlug || !taskId) return;

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.rpc("claim_task", { task_id: taskId });
  if (error) {
    serverRedirect(`/${orgSlug}/tasks?taskAction=error`);
  }
  revalidatePath(`/${orgSlug}/tasks`);
  revalidatePath(`/${orgSlug}/dashboard`);
  serverRedirect(`/${orgSlug}/tasks?taskAction=claimed`);
}

export async function offerTaskAction(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const taskId = String(formData.get("taskId") ?? "").trim();
  if (!orgSlug || !taskId) return;

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.rpc("offer_task", { task_id: taskId });
  if (error) {
    serverRedirect(`/${orgSlug}/tasks?taskAction=error`);
  }
  revalidatePath(`/${orgSlug}/tasks`);
  revalidatePath(`/${orgSlug}/dashboard`);
  serverRedirect(`/${orgSlug}/tasks?taskAction=offered`);
}
