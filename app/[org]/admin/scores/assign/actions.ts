"use server";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin } from "../../../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../../../lib/supabaseServer";
import { addEngagementEvent } from "../../../../../lib/engagement/addEvent";
import { isEngagementEnabledFromOrgRow } from "../../../../../lib/engagement/isEngagementEnabled";

export async function getAssignPointsPreview(orgSlug: string, profileId: string) {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!isEngagementEnabledFromOrgRow(org as any)) {
    return { errorKey: "engagement.unauthorized" as const };
  }
  if (!(await isOrgAdmin(orgIdForData, orgSlug))) {
    return { errorKey: "engagement.unauthorized" as const };
  }
  if (!profileId) {
    return { errorKey: "engagement.assign_validation" as const };
  }
  const supabase = createSupabaseServiceRoleClient();
  const { data: row } = await supabase
    .from("engagement_scores")
    .select("score")
    .eq("user_id", profileId)
    .eq("organization_id", orgIdForData)
    .maybeSingle();
  const currentScore = typeof row?.score === "number" ? row.score : 0;
  return { currentScore };
}

export async function assignPoints(
  orgSlug: string,
  profileId: string,
  points: number,
  reason: string
) {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!isEngagementEnabledFromOrgRow(org as any)) {
    return { errorKey: "engagement.unauthorized" };
  }
  if (!(await isOrgAdmin(orgIdForData, orgSlug))) {
    return { errorKey: "engagement.unauthorized" };
  }
  if (!profileId || typeof points !== "number") {
    return { errorKey: "engagement.assign_validation" };
  }
  const trimmedReason = String(reason ?? "").trim();
  if (!trimmedReason) {
    return { errorKey: "engagement.reason_required" };
  }
  const minNeg = 20;
  const minPos = 5;
  if (points < 0 && trimmedReason.length < minNeg) {
    return { errorKey: "engagement.reason_negative_min" };
  }
  if (points >= 0 && trimmedReason.length < minPos) {
    return { errorKey: "engagement.reason_positive_min" };
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

  const newEventId = await addEngagementEvent(supabase, {
    userId: profileId,
    organizationId: orgIdForData,
    eventType: "score_import",
    points,
    sourceId: null,
    category: "other"
  });
  if (!newEventId) return { error: "Engagement-Event konnte nicht angelegt werden." };
  const eventRow = { id: newEventId };

  const { error: logErr } = await supabase.from("score_import_log").insert({
    organization_id: orgIdForData,
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
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData, orgSlug))) {
    return { errorKey: "engagement.unauthorized" };
  }
  if (!logId) return { errorKey: "engagement.entry_not_found" };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { errorKey: "engagement.remove_error" };
  }
  const supabase = createSupabaseServiceRoleClient();

  const { data: logRow, error: fetchErr } = await supabase
    .from("score_import_log")
    .select("id, user_id, points, created_at, engagement_event_id, organization_id")
    .eq("id", logId)
    .eq("organization_id", orgIdForData)
    .single();
  if (fetchErr || !logRow) return { errorKey: "engagement.entry_not_found" };

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
