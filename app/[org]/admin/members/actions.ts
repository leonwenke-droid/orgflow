"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData } from "../../../../lib/getOrganization";
import { canAddMember } from "../../../../lib/planLimits";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import {
  buildInviteUrl,
  buildWhatsAppInviteText,
  generateInviteToken,
  hashInviteToken,
  inviteExpiresAt
} from "../../../../lib/memberInvites";
import { getPublicBaseUrl } from "../../../../lib/publicBaseUrl";

const LEGACY_DEFAULT_ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function mapMemberDbError(error: { message?: string } | null): { error: string | null; errorKey?: string } {
  if (!error?.message) return { error: "Unknown error." };
  if (/stack depth limit exceeded/i.test(error.message)) {
    return { error: null, errorKey: "common.generic_error" };
  }
  return { error: error.message };
}

async function issueMemberInvite(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  orgId: string,
  orgName: string,
  profile: { id: string; full_name?: string | null; email?: string | null }
): Promise<{ inviteUrl: string; whatsappText: string; expiresAt: string }> {
  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = inviteExpiresAt();
  await supabase
    .from("profiles")
    .update({
      status: "invited",
      invite_status: "pending",
      invite_token_hash: tokenHash,
      invite_expires_at: expiresAt.toISOString(),
      invited_at: new Date().toISOString(),
      activated_at: null
    })
    .eq("id", profile.id)
    .eq("organization_id", orgId);

  const inviteUrl = buildInviteUrl(await getPublicBaseUrl(), token);
  const whatsappText = buildWhatsAppInviteText({
    firstName: profile.full_name?.split(" ")?.[0] ?? null,
    organizationName: orgName,
    inviteUrl
  });
  return { inviteUrl, whatsappText, expiresAt: expiresAt.toISOString() };
}

/**
 * Weist alle Profile und Engagement-Scores dem Jahrgangs-Org aaaa... zu (nur für Slug abi-2026-tgg / abi2026-tgg).
 * organization_id = aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa ist die eine Org für diesen Jahrgang (Multi-Tenant).
 */
export async function syncOrgDataAction(orgSlug: string): Promise<{ error: string | null; errorKey?: string; updated?: number }> {
  const slug = (orgSlug || "").trim();
  const allowedSlugs = ["abi-2026-tgg", "abi2026-tgg"];
  if (!allowedSlugs.includes(slug)) {
    return { error: "Sync nur für Organisation abi-2026-tgg / abi2026-tgg verfügbar." };
  }

  const org = await getCurrentOrganization(slug);
  if (!(await isOrgAdmin(org.id))) return { error: null, errorKey: "common.unauthorized" };

  const { createSupabaseServiceRoleClient } = await import("../../../../lib/supabaseServer");
  const service = createSupabaseServiceRoleClient();
  const targetOrgId = LEGACY_DEFAULT_ORG_ID;

  let updatedCount = 0;
  const { data: profNull } = await service
    .from("profiles")
    .update({ organization_id: targetOrgId })
    .is("organization_id", null)
    .select("id");
  updatedCount += (profNull ?? []).length;

  const { data: profOther } = await service
    .from("profiles")
    .update({ organization_id: targetOrgId })
    .neq("organization_id", targetOrgId)
    .select("id");
  updatedCount += (profOther ?? []).length;

  await service
    .from("engagement_scores")
    .update({ organization_id: targetOrgId })
    .is("organization_id", null);
  await service
    .from("engagement_scores")
    .update({ organization_id: targetOrgId })
    .neq("organization_id", targetOrgId);

  revalidatePath(`/${slug}/admin`);
  revalidatePath(`/${slug}/admin/members`);
  return { error: null, updated: updatedCount };
}

export async function updateMemberNameAction(
  orgSlug: string,
  profileId: string,
  fullName: string
): Promise<{ error: string | null; errorKey?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: null, errorKey: "common.unauthorized" };
  const name = (fullName || "").trim();
  if (!name) return { error: null, errorKey: "members.error_name_required" };

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: name })
    .eq("id", profileId)
    .eq("organization_id", orgIdForData);

  if (error) return mapMemberDbError(error);
  revalidatePath(`/${orgSlug}/admin/members`);
  return { error: null };
}

export async function updateMemberCommitteesAction(
  orgSlug: string,
  profileId: string,
  committeeIds: string[]
): Promise<{ error: string | null; errorKey?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: null, errorKey: "common.unauthorized" };

  const supabase = createSupabaseServiceRoleClient();

  const ids = committeeIds.filter(Boolean);
  const primaryId = ids[0] || null;

  const { error: delErr } = await supabase
    .from("profile_committees")
    .delete()
    .eq("user_id", profileId);

  if (delErr) return mapMemberDbError(delErr);

  if (ids.length > 0) {
    const { error: insErr } = await supabase.from("profile_committees").insert(
      ids.map((cid) => ({ user_id: profileId, committee_id: cid }))
    );
    if (insErr) return mapMemberDbError(insErr);
  }

  const { error } = await supabase
    .from("profiles")
    .update({ committee_id: primaryId })
    .eq("id", profileId)
    .eq("organization_id", orgIdForData);

  if (error) return mapMemberDbError(error);
  revalidatePath(`/${orgSlug}/admin/members`);
  return { error: null };
}

export async function updateMemberRoleAction(
  orgSlug: string,
  profileId: string,
  role: "member" | "lead"
): Promise<{ error: string | null; errorKey?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: null, errorKey: "common.unauthorized" };

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", profileId)
    .eq("organization_id", orgIdForData);

  if (error) return mapMemberDbError(error);
  revalidatePath(`/${orgSlug}/admin/members`);
  return { error: null };
}

export async function deleteMemberAction(
  orgSlug: string,
  profileId: string
): Promise<{ error: string | null; errorKey?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: null, errorKey: "common.unauthorized" };

  const supabase = createSupabaseServiceRoleClient();

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", profileId)
    .eq("organization_id", orgIdForData);

  if (error) return mapMemberDbError(error);

  revalidatePath(`/${orgSlug}/admin/members`);
  return { error: null };
}

export async function setMemberStatusAction(
  orgSlug: string,
  profileId: string,
  status: "invited" | "active" | "disabled"
): Promise<{ error: string | null; errorKey?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: null, errorKey: "common.unauthorized" };

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      status,
      invite_status: status === "disabled" ? "revoked" : status === "active" ? "accepted" : "pending",
      ...(status === "disabled"
        ? { invite_token_hash: null, invite_expires_at: null }
        : {})
    })
    .eq("id", profileId)
    .eq("organization_id", orgIdForData);

  if (error) return mapMemberDbError(error);
  revalidatePath(`/${orgSlug}/admin/members`);
  return { error: null };
}

export async function resendLeadInviteAction(
  orgSlug: string,
  profileId: string
): Promise<{ error: string | null; errorKey?: string; inviteUrl?: string; whatsappText?: string; expiresAt?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: null, errorKey: "common.unauthorized" };

  const supabase = createSupabaseServiceRoleClient();
  const { data: profile, error: fetchErr } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", profileId)
    .eq("organization_id", orgIdForData)
    .single();

  if (fetchErr || !profile) return { error: null, errorKey: "members.error_profile_not_found" };
  const inviteResult = await issueMemberInvite(
    supabase,
    orgIdForData,
    org.name,
    {
      id: profileId,
      full_name: (profile as { full_name?: string | null }).full_name ?? "",
      email: (profile as { email?: string | null }).email ?? null
    }
  );

  revalidatePath(`/${orgSlug}/admin/members`);
  return { error: null, ...inviteResult };
}

/**
 * Person nachträglich als Komiteeleitung (Lead) eintragen. E-Mail ist Pflicht; Einladungs-Mail wird gesendet, falls noch kein Login.
 */
export async function setMemberAsLeadAction(
  orgSlug: string,
  profileId: string,
  email: string
): Promise<{ error: string | null; errorKey?: string; inviteUrl?: string; whatsappText?: string; expiresAt?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: null, errorKey: "common.unauthorized" };

  const emailTrimmed = (email || "").trim();
  if (!emailTrimmed) return { error: null, errorKey: "members.error_email_required_lead" };

  const supabase = createSupabaseServiceRoleClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, auth_user_id, status")
    .eq("id", profileId)
    .eq("organization_id", orgIdForData)
    .single();

  if (!profile) return { error: null, errorKey: "members.error_profile_not_found" };

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ role: "lead", email: emailTrimmed, status: "invited", invite_status: "pending" })
    .eq("id", profileId)
    .eq("organization_id", orgIdForData);

  if (updateErr) return mapMemberDbError(updateErr);

  revalidatePath(`/${orgSlug}/admin/members`);
  if (!(profile as { auth_user_id?: string | null }).auth_user_id || (profile as { status?: string | null }).status !== "active") {
    const inviteResult = await issueMemberInvite(
      supabase,
      orgIdForData,
      org.name,
      { id: profileId, full_name: (profile as { full_name?: string }).full_name ?? "", email: emailTrimmed }
    );
    return { error: null, ...inviteResult };
  }

  return { error: null };
}

/**
 * Mitglied manuell anlegen (nur Name erforderlich, Komitees optional).
 * Bei Lead mit E-Mail: Einladungs-Mail mit Link zum Passwort setzen wird versendet.
 */
export async function addMemberAction(
  orgSlug: string,
  fullName: string,
  options?: { email?: string; committeeIds?: string[]; asLead?: boolean }
): Promise<{ error: string | null; errorKey?: string; inviteUrl?: string; whatsappText?: string; expiresAt?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: null, errorKey: "common.unauthorized" };

  const name = (fullName || "").trim();
  if (!name) return { error: null, errorKey: "members.error_name_required" };

  const supabase = createSupabaseServiceRoleClient();

  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgIdForData);
  if (!canAddMember(org.plan, count ?? 0)) {
    return { error: null, errorKey: "members.error_member_limit" };
  }

  const { randomUUID } = await import("crypto");
  const id = randomUUID();
  const role = options?.asLead ? "lead" : "member";
  const emailTrimmed = (options?.email || "").trim() || null;
  const committeeIds = (options?.committeeIds ?? []).filter(Boolean);
  const primaryCommitteeId = committeeIds[0] || null;

  const { error } = await supabase.from("profiles").insert({
    id,
    full_name: name,
    role,
    organization_id: orgIdForData,
    committee_id: primaryCommitteeId,
    email: emailTrimmed,
    auth_user_id: null,
    status: "invited",
    invite_status: "pending"
  });

  if (error) return mapMemberDbError(error);

  if (committeeIds.length > 0) {
    await supabase.from("profile_committees").insert(
      committeeIds.map((cid) => ({ user_id: id, committee_id: cid }))
    );
  }

  const inviteResult = await issueMemberInvite(
    supabase,
    orgIdForData,
    org.name,
    { id, full_name: name, email: emailTrimmed }
  );

  revalidatePath(`/${orgSlug}/admin/members`);
  return { error: null, ...inviteResult };
}
