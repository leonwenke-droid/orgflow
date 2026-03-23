"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";

type Props = {
  organizationId: string | null;
  table: "tasks" | "shift_assignments";
};

export default function RealtimeRefreshBridge({ organizationId, table }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!organizationId) return;
    const supabase = createSupabaseBrowserClient();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 250);
    };

    const channel = supabase
      .channel(`admin-${table}-${organizationId}`)
      .on(
        "postgres_changes",
        table === "tasks"
          ? { event: "*", schema: "public", table, filter: `organization_id=eq.${organizationId}` }
          : { event: "*", schema: "public", table },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [organizationId, table, router]);

  return null;
}
