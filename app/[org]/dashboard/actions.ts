"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { redirect } from "next/navigation";
import { writeAuditLog } from "../../../lib/audit";
import { claimShiftForAuthenticatedMember } from "../../../lib/claimShiftForMember";
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

  const result = await claimShiftForAuthenticatedMember({
    authUserId: user.id,
    orgSlug,
    shiftId,
    organizationIdFromForm: organizationId
  });

  if (!result.ok) {
    console.error("[claimShiftFromDashboard]", result.code);
    redirect(`/${orgSlug}/dashboard?claimShift=error`);
  }

  await writeAuditLog({
    organizationId: result.organizationId,
    actorProfileId: result.profileId,
    action: "shift_claimed",
    targetTable: "shifts",
    targetId: shiftId,
    metadata: {}
  });

  const service = createSupabaseServiceRoleClient();
  await createUserNotification(service, {
    profileId: result.profileId,
    organizationId: result.organizationId,
    type: "shift_self_claimed",
    title: "Schicht übernommen",
    body: "Du hast dich für eine Schicht eingetragen.",
    link: `/${orgSlug}/shifts`
  });

  revalidatePath(`/${orgSlug}/shifts`);
  revalidatePath(`/${orgSlug}/dashboard`);
}
