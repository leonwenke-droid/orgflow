"use server";

import { revalidatePath } from "next/cache";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { getCurrentOrganization } from "../../../lib/getOrganization";
import { getOrgIdForData } from "../../../lib/getOrganization";

export async function claimShift(orgSlug: string, shiftId: string): Promise<{ error?: string }> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Sign in required." };

    const org = await getCurrentOrganization(orgSlug);
    const orgIdForData = getOrgIdForData(orgSlug, org.id);
    const service = createSupabaseServiceRoleClient();

    const { data: profile } = await service
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("organization_id", orgIdForData)
      .single();
    if (!profile) return { error: "You are not a member of this organisation." };

    const { data: shift } = await service
      .from("shifts")
      .select("id, organization_id, required_slots")
      .eq("id", shiftId)
      .eq("organization_id", orgIdForData)
      .single();
    if (!shift) return { error: "Shift not found." };

    const { count } = await service
      .from("shift_assignments")
      .select("id", { count: "exact", head: true })
      .eq("shift_id", shiftId);
    const required = Number(shift.required_slots ?? 0) || 1;
    if ((count ?? 0) >= required) return { error: "No free slots." };

    const { error: insertErr } = await service.from("shift_assignments").insert({
      shift_id: shiftId,
      user_id: profile.id,
      status: "zugewiesen",
    });
    if (insertErr) {
      if (insertErr.code === "23505") return { error: "You are already assigned." };
      return { error: insertErr.message || "Failed to sign up." };
    }

    revalidatePath(`/${orgSlug}/dashboard`);
    return {};
  } catch (e) {
    console.error("[claimShift]", e);
    return { error: "An error occurred." };
  }
}
