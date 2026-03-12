"use server";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentOrganization, isOrgAdmin } from "../../../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../../../lib/supabaseServer";

export async function assignPoints(
  orgSlug: string,
  profileId: string,
  points: number,
  reason: string
) {
  const org = await getCurrentOrganization(orgSlug);
  if (!(await isOrgAdmin(org.id))) {
    return { error: "Keine Berechtigung." };
  }
  if (!profileId || typeof points !== "number") {
    return { error: "Mitglied und Punkte angeben." };
  }
  const trimmedReason = String(reason ?? "").trim();
  if (!trimmedReason) {
    return { error: "Reason is required." };
  }

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceRoleClient()
    : createServerComponentClient({ cookies });

  let createdBy: string | null = null;
  const authClient = createServerComponentClient({ cookies });
  const { data: { user } } = await authClient.auth.getUser();
  if (user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    createdBy = profile?.id ?? null;
  }

  const { data: eventRow, error: eventErr } = await supabase
    .from("engagement_events")
    .insert({
      user_id: profileId,
      event_type: "score_import",
      points,
      source_id: null
    })
    .select("id")
    .single();
  if (eventErr || !eventRow) return { error: eventErr?.message ?? "Engagement-Event konnte nicht angelegt werden." };

  const { error: logErr } = await supabase.from("score_import_log").insert({
    organization_id: org.id,
    user_id: profileId,
    points,
    reason: trimmedReason,
    created_by: createdBy,
    engagement_event_id: eventRow.id
  });
  if (logErr) return { error: logErr.message };

  revalidatePath(`/${orgSlug}/admin`);
  revalidatePath(`/${orgSlug}/admin/scores/assign`);
  return { success: true };
}

export async function removeScoreImport(orgSlug: string, logId: string) {
  const org = await getCurrentOrganization(orgSlug);
  if (!(await isOrgAdmin(org.id))) {
    return { error: "Keine Berechtigung." };
  }
  if (!logId) return { error: "Eintrag nicht gefunden." };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Server-Konfiguration: SUPABASE_SERVICE_ROLE_KEY fehlt. Entfernen nicht möglich." };
  }
  const supabase = createSupabaseServiceRoleClient();

  const { data: logRow, error: fetchErr } = await supabase
    .from("score_import_log")
    .select("id, user_id, points, created_at, engagement_event_id, organization_id")
    .eq("id", logId)
    .eq("organization_id", org.id)
    .single();
  if (fetchErr || !logRow) return { error: "Eintrag nicht gefunden oder keine Berechtigung." };

  let eventId = logRow.engagement_event_id as string | null;
  if (!eventId) {
    const logCreated = new Date((logRow as any).created_at).getTime();
    const { data: candidates } = await supabase
      .from("engagement_events")
      .select("id, created_at")
      .eq("user_id", logRow.user_id)
      .eq("event_type", "score_import")
      .eq("points", logRow.points)
      .is("source_id", null)
      .gte("created_at", new Date(logCreated - 120000).toISOString())
      .lte("created_at", new Date(logCreated + 120000).toISOString());
    if (!candidates?.length) return { error: "Zugehöriges Engagement-Event nicht gefunden." };
    if (candidates.length > 1) {
      const closest = candidates.reduce((a, b) =>
        Math.abs(new Date(a.created_at).getTime() - logCreated) < Math.abs(new Date(b.created_at).getTime() - logCreated) ? a : b
      );
      eventId = closest.id;
    } else {
      eventId = candidates[0].id;
    }
  }

  const { error: delEventErr } = await supabase
    .from("engagement_events")
    .delete()
    .eq("id", eventId);
  if (delEventErr) return { error: delEventErr.message };

  const { error: delLogErr } = await supabase
    .from("score_import_log")
    .delete()
    .eq("id", logId);
  if (delLogErr) return { error: delLogErr.message };

  revalidatePath(`/${orgSlug}/admin`);
  revalidatePath(`/${orgSlug}/admin/scores/assign`);
  return { success: true };
}
