import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationInput = {
  profileId: string;
  organizationId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
};

/** Insert via service client (bypasses RLS). */
export async function createUserNotification(
  service: SupabaseClient,
  input: NotificationInput
): Promise<void> {
  const { error } = await service.from("user_notifications").insert({
    profile_id: input.profileId,
    organization_id: input.organizationId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null
  });
  if (error) {
    console.error("[notifications] insert failed:", error);
  }
}

/** Notify every profile in the org that has a finance-capable or admin role (treasury updates). */
export async function notifyFinanceAudience(
  service: SupabaseClient,
  organizationId: string,
  title: string,
  body: string,
  link: string
): Promise<void> {
  const roles = ["admin", "lead", "owner", "finance"];
  const { data: profiles } = await service
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .in("role", roles)
    .neq("status", "disabled");
  for (const p of profiles ?? []) {
    await createUserNotification(service, {
      profileId: (p as { id: string }).id,
      organizationId,
      type: "treasury_update",
      title,
      body,
      link
    });
  }
}
