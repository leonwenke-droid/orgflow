import { createSupabaseServiceRoleClient } from "./supabaseServer";

export async function writeAuditLog(params: {
  organizationId?: string | null;
  actorProfileId?: string | null;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const service = createSupabaseServiceRoleClient();
    await service.from("audit_logs").insert({
      organization_id: params.organizationId ?? null,
      actor_profile_id: params.actorProfileId ?? null,
      action: params.action,
      target_table: params.targetTable ?? null,
      target_id: params.targetId ?? null,
      metadata: params.metadata ?? {}
    });
  } catch {
    // non-blocking
  }
}

