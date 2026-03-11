"use server";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentOrganization, isOrgAdmin, getOrgIdForData } from "../../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { canAddMember } from "../../../../lib/planLimits";

const LEGACY_DEFAULT_ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL_SEND_MAGIC_LINK ||
  "https://n8n.srv881499.hstgr.cloud/webhook/send-magic-link";

function getBaseUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  // Fallback für lokale Entwicklung: root von localhost
  return "http://localhost:3000";
}

function formatInviteError(message: string): string {
  const m = (message || "").toLowerCase();
  if (m.includes("rate limit") || m.includes("rate_limit") || m.includes("too many")) {
    return "E-Mail-Limit von Supabase erreicht. Bitte in einigen Minuten erneut versuchen oder später die Einladung erneut senden.";
  }
  return message;
}

/**
 * Erzeugt Einladungslink (generateLink magiclink), sendet ihn per n8n-Webhook und verknüpft ggf. das Profil mit dem Auth-User.
 * Der eingeladene Nutzer setzt sein Passwort anschließend über /auth/lead-setup.
 */
async function sendInviteViaN8n(
  service: ReturnType<typeof createSupabaseServiceRoleClient>,
  email: string,
  fullName: string,
  orgSlug: string,
  profileId: string | null
): Promise<{ error: string | null }> {
  const baseUrl = getBaseUrl();
  const redirectTo = baseUrl
    ? `${baseUrl}/auth/lead-setup?next=/${encodeURIComponent(orgSlug)}/admin`
    : undefined;

  const { data: linkData, error } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      data: { full_name: fullName },
      ...(redirectTo && { redirectTo })
    }
  });

  if (error) {
    return { error: formatInviteError(error.message) };
  }

  const actionLink =
    (linkData as { properties?: { action_link?: string } })?.properties?.action_link ??
    (linkData as { action_link?: string })?.action_link;
  if (!actionLink || typeof actionLink !== "string") {
    return { error: "Invite link could not be generated." };
  }

  const subject = "Invitation as team lead – OrgFlow";
  const body =
    (fullName ? `Hello ${fullName.trim()},\n\n` : "Hello,\n\n") +
    "You have been invited as a team lead. Click the link below to activate your account and set a password:\n\n" +
    actionLink +
    "\n\nAfter setting your password you will be redirected to the admin dashboard.\n\nBest regards\nOrgFlow Team";

  const webhookRes = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      confirmLink: actionLink,
      fullName: fullName || undefined,
      type: "invite",
      subject,
      body
    })
  });

  if (!webhookRes.ok) {
    return { error: "Email could not be sent. Please try again later." };
  }

  const newUserId = (linkData as { user?: { id?: string }; id?: string })?.user?.id ?? (linkData as { id?: string })?.id;
  if (profileId && newUserId && typeof newUserId === "string") {
    await service.from("profiles").update({ auth_user_id: newUserId }).eq("id", profileId);
  }

  return { error: null };
}

/**
 * Weist alle Profile und Engagement-Scores dem Jahrgangs-Org aaaa... zu (nur für Slug abi-2026-tgg / abi2026-tgg).
 * organization_id = aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa ist die eine Org für diesen Jahrgang (Multi-Tenant).
 */
export async function syncOrgDataAction(orgSlug: string): Promise<{ error: string | null; updated?: number }> {
  const slug = (orgSlug || "").trim();
  const allowedSlugs = ["abi-2026-tgg", "abi2026-tgg"];
  if (!allowedSlugs.includes(slug)) {
    return { error: "Sync nur für Organisation abi-2026-tgg / abi2026-tgg verfügbar." };
  }

  const org = await getCurrentOrganization(slug);
  if (!(await isOrgAdmin(org.id))) return { error: "Keine Berechtigung." };

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
): Promise<{ error: string | null }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: "Keine Berechtigung." };
  const name = (fullName || "").trim();
  if (!name) return { error: "Name darf nicht leer sein." };

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceRoleClient()
    : createServerComponentClient({ cookies });
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: name })
    .eq("id", profileId)
    .eq("organization_id", orgIdForData);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/admin/members`);
  return { error: null };
}

export async function updateMemberCommitteesAction(
  orgSlug: string,
  profileId: string,
  committeeIds: string[]
): Promise<{ error: string | null }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: "Keine Berechtigung." };

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceRoleClient()
    : createServerComponentClient({ cookies });

  const ids = committeeIds.filter(Boolean);
  const primaryId = ids[0] || null;

  const { error: delErr } = await supabase
    .from("profile_committees")
    .delete()
    .eq("user_id", profileId);

  if (delErr) return { error: delErr.message };

  if (ids.length > 0) {
    const { error: insErr } = await supabase.from("profile_committees").insert(
      ids.map((cid) => ({ user_id: profileId, committee_id: cid }))
    );
    if (insErr) return { error: insErr.message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ committee_id: primaryId })
    .eq("id", profileId)
    .eq("organization_id", orgIdForData);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/admin/members`);
  return { error: null };
}

export async function updateMemberRoleAction(
  orgSlug: string,
  profileId: string,
  role: "member" | "lead"
): Promise<{ error: string | null }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: "Keine Berechtigung." };

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceRoleClient()
    : createServerComponentClient({ cookies });
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", profileId)
    .eq("organization_id", orgIdForData);

  if (error) return { error: error.message };
  revalidatePath(`/${orgSlug}/admin/members`);
  return { error: null };
}

export async function deleteMemberAction(
  orgSlug: string,
  profileId: string
): Promise<{ error: string | null }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: "Keine Berechtigung." };

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceRoleClient()
    : createServerComponentClient({ cookies });

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", profileId)
    .eq("organization_id", orgIdForData);

  if (error) return { error: error.message };

  revalidatePath(`/${orgSlug}/admin/members`);
  return { error: null };
}

export async function resendLeadInviteAction(
  orgSlug: string,
  profileId: string
): Promise<{ error: string | null }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: "Keine Berechtigung." };

  const service = createSupabaseServiceRoleClient();
  const { data: profile, error: fetchErr } = await service
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", profileId)
    .eq("organization_id", orgIdForData)
    .single();

  if (fetchErr || !profile) return { error: "Profil nicht gefunden." };
  const email = (profile as { email?: string | null }).email ?? null;
  if (!email) return { error: "Für dieses Mitglied ist keine E-Mail hinterlegt." };

  const inviteResult = await sendInviteViaN8n(
    service,
    email,
    (profile as { full_name?: string | null }).full_name ?? "",
    orgSlug,
    profileId
  );

  if (inviteResult.error) {
    return { error: `Einladung konnte nicht erneut gesendet werden: ${inviteResult.error}` };
  }

  revalidatePath(`/${orgSlug}/admin/members`);
  return { error: null };
}

/**
 * Person nachträglich als Komiteeleitung (Lead) eintragen. E-Mail ist Pflicht; Einladungs-Mail wird gesendet, falls noch kein Login.
 */
export async function setMemberAsLeadAction(
  orgSlug: string,
  profileId: string,
  email: string
): Promise<{ error: string | null }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: "Keine Berechtigung." };

  const emailTrimmed = (email || "").trim();
  if (!emailTrimmed) return { error: "Email is required for team lead." };

  const service = createSupabaseServiceRoleClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, full_name, auth_user_id")
    .eq("id", profileId)
    .eq("organization_id", orgIdForData)
    .single();

  if (!profile) return { error: "Profil nicht gefunden." };

  const { error: updateErr } = await service
    .from("profiles")
    .update({ role: "lead", email: emailTrimmed })
    .eq("id", profileId)
    .eq("organization_id", orgIdForData);

  if (updateErr) return { error: updateErr.message };

  if (!profile.auth_user_id) {
    const inviteResult = await sendInviteViaN8n(
      service,
      emailTrimmed,
      (profile as { full_name?: string }).full_name ?? "",
      orgSlug,
      profileId
    );
    if (inviteResult.error) {
      revalidatePath(`/${orgSlug}/admin/members`);
      return { error: `Als Lead gesetzt, aber Einladungs-Mail konnte nicht gesendet werden: ${inviteResult.error}` };
    }
  }

  revalidatePath(`/${orgSlug}/admin/members`);
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
): Promise<{ error: string | null }> {
  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) return { error: "No permission." };

  const name = (fullName || "").trim();
  if (!name) return { error: "Name is required." };

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseServiceRoleClient()
    : createServerComponentClient({ cookies });

  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgIdForData);
  if (!canAddMember(org.plan, count ?? 0)) {
    return { error: "Member limit reached for your plan. Upgrade to add more members." };
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
    auth_user_id: null
  });

  if (error) return { error: error.message };

  if (committeeIds.length > 0) {
    await supabase.from("profile_committees").insert(
      committeeIds.map((cid) => ({ user_id: id, committee_id: cid }))
    );
  }

  if (options?.asLead && emailTrimmed) {
    const serviceInvite = createSupabaseServiceRoleClient();
    const inviteResult = await sendInviteViaN8n(
      serviceInvite,
      emailTrimmed,
      name,
      orgSlug,
      id
    );
    if (inviteResult.error) {
      revalidatePath(`/${orgSlug}/admin/members`);
      return { error: `Member added, but invite email could not be sent: ${inviteResult.error}` };
    }
  }

  revalidatePath(`/${orgSlug}/admin/members`);
  return { error: null };
}
