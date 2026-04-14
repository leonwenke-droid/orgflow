import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin } from "../../../lib/getOrganization";
import {
  buildInviteUrl,
  buildWhatsAppInviteText,
  generateInviteToken,
  hashInviteToken,
  inviteExpiresAt
} from "../../../lib/memberInvites";
import { sendEmail as sendEmailMessage } from "../../../lib/email";
import { writeAuditLog } from "../../../lib/audit";
import { getPublicBaseUrl } from "../../../lib/publicBaseUrl";
import { checkRateLimit } from "../../../lib/rateLimit";
import { asTrimmedString, readJson } from "../../../lib/validation";

async function getRequesterProfileId(orgId: string, authUserId: string) {
  const service = createSupabaseServiceRoleClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("organization_id", orgId)
    .maybeSingle();
  return profile?.id ?? null;
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const parsed = await readJson<{ orgSlug?: unknown; profileId?: unknown; sendEmail?: unknown }>(req);
  if (!parsed.ok) {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }
  const orgSlug = asTrimmedString(parsed.data.orgSlug);
  const profileId = asTrimmedString(parsed.data.profileId);
  const sendEmail = parsed.data.sendEmail === true;

  if (!orgSlug || !profileId) {
    return NextResponse.json({ message: "orgSlug and profileId required." }, { status: 400 });
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimit(`member_invites:send:${ip}:${orgSlug.toLowerCase()}`, 20);
  if (!rl.ok) {
    return NextResponse.json(
      { message: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData, orgSlug))) {
    return NextResponse.json({ message: "Forbidden", errorKey: "common.unauthorized" }, { status: 403 });
  }

  const service = createSupabaseServiceRoleClient();
  const { data: member } = await service
    .from("profiles")
    .select("id, full_name, email, status, organization_id")
    .eq("id", profileId)
    .eq("organization_id", orgIdForData)
    .single();

  if (!member) {
    return NextResponse.json({ message: "Member not found.", errorKey: "members.error_profile_not_found" }, { status: 404 });
  }
  if ((member as { status?: string | null }).status === "active" && !sendEmail) {
    return NextResponse.json({ message: "Active members do not need a new invite.", errorKey: "members.status_active" }, { status: 400 });
  }

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = inviteExpiresAt();
  const invitedBy = await getRequesterProfileId(orgIdForData, user.id);

  const { error: updateError } = await service
    .from("profiles")
    .update({
      status: "invited",
      invite_status: "pending",
      invite_token_hash: tokenHash,
      invite_expires_at: expiresAt.toISOString(),
      invited_at: new Date().toISOString(),
      invited_by: invitedBy,
      activated_at: null
    })
    .eq("id", profileId)
    .eq("organization_id", orgIdForData);

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 });
  }

  const inviteUrl = buildInviteUrl(await getPublicBaseUrl(), token);
  const whatsappText = buildWhatsAppInviteText({
    firstName: member.full_name?.split(" ")[0] ?? null,
    organizationName: org.name,
    inviteUrl
  });

  if (sendEmail && member.email) {
    const subject = `Invite to ${org.name} on OrgFlow`;
    const text = [
      `Hi${member.full_name ? ` ${String(member.full_name).split(" ")[0]}` : ""},`,
      ``,
      `you have been invited to OrgFlow for ${org.name}.`,
      `Set your password here:`,
      inviteUrl,
      ``,
      `OrgFlow`
    ].join("\n");
    await sendEmailMessage({ to: member.email, subject, text });
  }

  await writeAuditLog({
    organizationId: orgIdForData,
    actorProfileId: invitedBy,
    action: "member_invite_issued",
    targetTable: "profiles",
    targetId: profileId,
    metadata: { sendEmail, hasEmail: Boolean(member.email) }
  });

  return NextResponse.json({
    inviteUrl,
    whatsappText,
    expiresAt: expiresAt.toISOString()
  });
}

export async function DELETE(req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const orgSlug = String(body.orgSlug ?? "").trim();
  const profileId = String(body.profileId ?? "").trim();
  if (!orgSlug || !profileId) {
    return NextResponse.json({ message: "orgSlug and profileId required." }, { status: 400 });
  }

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData, orgSlug))) {
    return NextResponse.json({ message: "Forbidden", errorKey: "common.unauthorized" }, { status: 403 });
  }

  const service = createSupabaseServiceRoleClient();
  const { error } = await service
    .from("profiles")
    .update({
      invite_status: "revoked",
      invite_token_hash: null,
      invite_expires_at: null
    })
    .eq("id", profileId)
    .eq("organization_id", orgIdForData);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
