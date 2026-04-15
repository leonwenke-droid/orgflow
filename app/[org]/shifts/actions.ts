"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { redirect } from "next/navigation";
import { claimShiftForAuthenticatedMember } from "../../../lib/claimShiftForMember";
import { createUserNotification } from "../../../lib/notifications";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { notifyAfterShiftSelfClaim } from "../../../lib/shiftClaimNotifications";

export async function claimShiftAction(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const shiftId = String(formData.get("shiftId") ?? "").trim();
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  if (!orgSlug || !shiftId || !organizationId) return;

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const result = await claimShiftForAuthenticatedMember({
    authUserId: user.id,
    orgSlug,
    shiftId,
    organizationIdFromForm: organizationId
  });
  if (!result.ok) {
    console.error("[claimShiftAction]", result.code);
    if (result.code === "unavailable") {
      redirect(`/${orgSlug}/shifts?claimShift=unavailable`);
    }
    redirect(`/${orgSlug}/shifts?claimShift=error`);
  }

  const service = createSupabaseServiceRoleClient();
  await notifyAfterShiftSelfClaim({
    service,
    organizationId: result.organizationId,
    claimerProfileId: result.profileId,
    orgSlug,
    shiftId
  });

  revalidatePath(`/${orgSlug}/shifts`);
  revalidatePath(`/${orgSlug}/dashboard`);
  revalidatePath("/admin/shifts");
}

export async function offerShiftSwapAction(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  if (!orgSlug || !assignmentId) return;

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.rpc("offer_shift_swap", { assignment_id: assignmentId });
  if (error) {
    redirect(`/${orgSlug}/shifts?swap=error`);
  }
  revalidatePath(`/${orgSlug}/shifts`);
  revalidatePath(`/${orgSlug}/dashboard`);
  redirect(`/${orgSlug}/shifts?swap=offered`);
}

export async function claimShiftSwapAction(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const organizationId = String(formData.get("organization_id") ?? "").trim();
  if (!orgSlug || !assignmentId || !organizationId) return;

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const service = createSupabaseServiceRoleClient();
  const { data: before } = await service
    .from("shift_assignments")
    .select("user_id, shift_id, shifts(event_name)")
    .eq("id", assignmentId)
    .maybeSingle();
  const originalOwnerId = (before as { user_id?: string } | null)?.user_id ?? null;

  const { error: rpcErr } = await supabase.rpc("claim_shift_swap", { assignment_id: assignmentId });
  if (rpcErr) {
    redirect(`/${orgSlug}/shifts?swap=error`);
  }

  const { data: claimerProf } = await service
    .from("profiles")
    .select("id, full_name")
    .eq("auth_user_id", user.id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (originalOwnerId) {
    const evName =
      (before as { shifts?: { event_name?: string } | null } | null)?.shifts?.event_name ?? "Schicht";
    const claimerName = (claimerProf as { full_name?: string } | null)?.full_name ?? "Jemand";
    await createUserNotification(service, {
      profileId: originalOwnerId,
      organizationId,
      type: "shift_swap_taken",
      title: "Schicht-Tausch übernommen",
      body: `${claimerName} hat dein Angebot für „${evName}“ übernommen.`,
      link: `/${orgSlug}/shifts`
    });
  }

  revalidatePath(`/${orgSlug}/shifts`);
  revalidatePath(`/${orgSlug}/dashboard`);
  redirect(`/${orgSlug}/shifts?swap=taken`);
}
