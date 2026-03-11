"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";

const COOKIE_NAME = "abi_task_verified";

export async function verifyTaskOwner(
  token: string,
  enteredName: string
): Promise<{ ok: boolean; message: string } | void> {
  const trimmed = enteredName.trim();
  if (!trimmed) {
    return { ok: false, message: "Bitte gib deinen Namen ein." };
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("owner_id")
    .eq("access_token", token)
    .maybeSingle();

  if (!task?.owner_id) {
    return { ok: false, message: "Aufgabe nicht gefunden." };
  }

  const { data: owner } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", task.owner_id)
    .single();

  const ownerName = (owner?.full_name ?? "").trim().toLowerCase();
  const entered = trimmed.toLowerCase();

  if (ownerName !== entered) {
    return {
      ok: false,
      message: "Der eingegebene Name stimmt nicht mit dem Verantwortlichen überein."
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
  });

  redirect(`/task/${token}`);
}
