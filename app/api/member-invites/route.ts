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

function getBaseUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  return fromEnv || "http://localhost:3000";
}

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

  const body = await req.json().catch(() => ({}));
  const orgSlug = String(body.orgSlug ?? "").trim();
  const profileId = String(body.profileId ?? "").trim();
  const sendEmail = body.sendEmail === true;

  if (!orgSlug || !profileId) {
    return NextResponse.json({ message: "orgSlug and profileId required." }, { status: 400 });
  }

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) {
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

  const inviteUrl = buildInviteUrl(getBaseUrl(), token);
  const whatsappText = buildWhatsAppInviteText({
    firstName: member.full_name?.split(" ")[0] ?? null,
    organizationName: org.name,
    inviteUrl
  });

  if (sendEmail && member.email) {
    // Optional email sending can be wired later; for now keep the copy-ready flow deterministic.
  }

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
  if (!(await isOrgAdmin(orgIdForData))) {
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
