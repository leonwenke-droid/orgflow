import type { SupabaseClient } from "@supabase/supabase-js";

export function tasksQuery(supabase: SupabaseClient, orgId: string) {
  return supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", orgId)
    .is("deleted_at", null);
}

