"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { redirect } from "next/navigation";
import { createUserNotification } from "../../../lib/notifications";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";

export async function claimShiftFromDashboard(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const shiftId = String(formData.get("shiftId") ?? "").trim();
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  if (!orgSlug || !shiftId || !organizationId) return;

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error: rpcErr } = await supabase.rpc("claim_shift_slot", { shift_id: shiftId });
  if (rpcErr) {
    console.error("[claimShiftFromDashboard]", rpcErr);
    redirect(`/${orgSlug}/dashboard?claimShift=error`);
  }

  const service = createSupabaseServiceRoleClient();
  const { data: prof } = await service
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (prof?.id) {
    await createUserNotification(service, {
      profileId: prof.id as string,
      organizationId,
      type: "shift_self_claimed",
      title: "Schicht übernommen",
      body: "Du hast dich für eine Schicht eingetragen.",
      link: `/${orgSlug}/shifts`
    });
  }

  revalidatePath(`/${orgSlug}/shifts`);
  revalidatePath(`/${orgSlug}/dashboard`);
}
