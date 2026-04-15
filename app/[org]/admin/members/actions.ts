"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getCurrentOrganization, getOrgIdForData } from "../../../../lib/getOrganization";
import { assertCanManageMembersAndTeams } from "../../../../lib/permissionsServer";
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
 * Gefährlicher Legacy-Reparatur-Lauf: weist Profile/Scores der aktuellen Org zu.
 * Nur wenn die Organisation in der DB `settings.legacy_bulk_sync` gesetzt hat (Opt-in).
 */
export async function syncOrgDataAction(orgSlug: string): Promise<{ error: string | null; errorKey?: string; updated?: number }> {
  const slug = (orgSlug || "").trim();

  const org = await getCurrentOrganization(slug);
  const settings = org.settings as { legacy_bulk_sync?: boolean } | undefined;
  if (!settings?.legacy_bulk_sync) {
    return { error: "Sync ist für diese Organisation nicht verfügbar." };
  }

  const orgIdForDataSync = getOrgIdForData(slug, org.id);
  if (!(await assertCanManageMembersAndTeams(orgIdForDataSync, org.id, slug)))
    return { error: null, errorKey: "common.unauthorized" };

  const { createSupabaseServiceRoleClient } = await import("../../../../lib/supabaseServer");
  const service = createSupabaseServiceRoleClient();
  const targetOrgId = org.id;

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
  if (!(await assertCanManageMembersAndTeams(orgIdForData, org.id, orgSlug))) return { error: null, errorKey: "common.unauthorized" };
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
  if (!(await assertCanManageMembersAndTeams(orgIdForData, org.id, orgSlug))) return { error: null, errorKey: "common.unauthorized" };

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

export type AssignableOrgRole = "member" | "lead" | "admin" | "owner" | "finance" | "viewer";

const ASSIGNABLE: AssignableOrgRole[] = ["member", "lead", "admin", "owner", "finance", "viewer"];

/**
 * Org roles: only organisation admins/owners (not team leads) — see assertCanManageMembersAndTeams.
 * Promoted admins can assign roles; team leads cannot access this action.
 */
export async function updateMemberRoleAction(
  orgSlug: string,
  profileId: string,
  role: AssignableOrgRole,
  options?: { leadEmail?: string | null }
): Promise<{ error: string | null; errorKey?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await assertCanManageMembersAndTeams(orgIdForData, org.id, orgSlug)))
    return { error: null, errorKey: "common.unauthorized" };

  if (!ASSIGNABLE.includes(role)) return { error: null, errorKey: "common.unauthorized" };

  const authClient = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await authClient.auth.getUser();
  if (!user?.id) return { error: null, errorKey: "common.unauthorized" };

  const service = createSupabaseServiceRoleClient();

  const { data: actorProfile } = await service
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("organization_id", orgIdForData)
    .maybeSingle();
  if (!actorProfile?.id) return { error: null, errorKey: "common.unauthorized" };

  const { data: target, error: targetErr } = await service
    .from("profiles")
    .select("id, role, email, auth_user_id, status, full_name")
    .eq("id", profileId)
    .eq("organization_id", orgIdForData)
    .single();

  if (targetErr || !target) return { error: null, errorKey: "members.error_profile_not_found" };

  if (target.role === "super_admin")
    return { error: null, errorKey: "members.error_super_role" };

  const oldRole = String(target.role ?? "member");
  const isSelf = actorProfile.id === profileId;
  const wasOrgManager = oldRole === "admin" || oldRole === "owner";
  const willBeOrgManager = role === "admin" || role === "owner";

  if (isSelf && wasOrgManager && !willBeOrgManager) {
    const { count, error: cErr } = await service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgIdForData)
      .in("role", ["admin", "owner"])
      .neq("id", profileId)
      .neq("status", "disabled");
    if (cErr) return mapMemberDbError(cErr);
    if ((count ?? 0) < 1) return { error: null, errorKey: "members.error_last_admin" };
  }

  if (role === "lead") {
    const emailResolved = String(options?.leadEmail ?? target.email ?? "").trim();
    if (!emailResolved) return { error: null, errorKey: "members.error_email_required_lead" };

    const hasLogin = !!target.auth_user_id;
    const isActive = target.status === "active";

    if (hasLogin && isActive) {
      const { error } = await service
        .from("profiles")
        .update({ role: "lead", email: emailResolved })
        .eq("id", profileId)
        .eq("organization_id", orgIdForData);
      if (error) return mapMemberDbError(error);
      revalidatePath(`/${orgSlug}/admin/members`);
      return { error: null };
    }

    return setMemberAsLeadAction(orgSlug, profileId, emailResolved);
  }

  const { error } = await service
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
  if (!(await assertCanManageMembersAndTeams(orgIdForData, org.id, orgSlug))) return { error: null, errorKey: "common.unauthorized" };

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
  if (!(await assertCanManageMembersAndTeams(orgIdForData, org.id, orgSlug))) return { error: null, errorKey: "common.unauthorized" };

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
  if (!(await assertCanManageMembersAndTeams(orgIdForData, org.id, orgSlug))) return { error: null, errorKey: "common.unauthorized" };

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
  if (!(await assertCanManageMembersAndTeams(orgIdForData, org.id, orgSlug))) return { error: null, errorKey: "common.unauthorized" };

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
 * Mitglied manuell anlegen (Name und E-Mail erforderlich, Komitees optional).
 * Einladung wird für die angegebene E-Mail erzeugt; optional Rolle Teamleitung (lead).
 */
export async function addMemberAction(
  orgSlug: string,
  fullName: string,
  options?: { email?: string; committeeIds?: string[]; asLead?: boolean }
): Promise<{ error: string | null; errorKey?: string; inviteUrl?: string; whatsappText?: string; expiresAt?: string }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await assertCanManageMembersAndTeams(orgIdForData, org.id, orgSlug))) return { error: null, errorKey: "common.unauthorized" };

  const name = (fullName || "").trim();
  if (!name) return { error: null, errorKey: "members.error_name_required" };

  const emailTrimmed = (options?.email || "").trim() || null;
  if (!emailTrimmed) return { error: null, errorKey: "members.error_email_required" };

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
