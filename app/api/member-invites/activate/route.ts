import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { hashInviteToken } from "../../../../lib/memberInvites";

async function findExistingAuthUserIdByEmail(email: string) {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = (data?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  return found?.id ?? null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.fullName ?? "").trim();
    const consentAccepted = Boolean(body.consentAccepted);

    if (!token || !email || !password) {
      return NextResponse.json({ message: "token, email and password are required." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters long." }, { status: 400 });
    }
    if (!consentAccepted) {
      return NextResponse.json({ message: "Consent required." }, { status: 400 });
    }

    const tokenHash = hashInviteToken(token);
    const service = createSupabaseServiceRoleClient();

    const { data: member, error: fetchError } = await service
      .from("profiles")
      .select("id, full_name, email, status, invite_status, invite_expires_at, invite_token_hash, organization_id, auth_user_id")
      .eq("invite_token_hash", tokenHash)
      .maybeSingle();

    if (fetchError || !member) {
      return NextResponse.json({ message: "Invalid invite link." }, { status: 400 });
    }

    if ((member as { status?: string }).status === "disabled") {
      return NextResponse.json({ message: "This account is disabled." }, { status: 403 });
    }

    if ((member as { invite_status?: string }).invite_status !== "pending") {
      return NextResponse.json({ message: "Invite link is no longer active." }, { status: 400 });
    }

    const expiresAt = (member as { invite_expires_at?: string | null }).invite_expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      await service
        .from("profiles")
        .update({ invite_status: "expired", status: "invited" })
        .eq("id", member.id);
      return NextResponse.json({ message: "Invite link has expired." }, { status: 400 });
    }

    const memberEmail = String((member as { email?: string | null }).email ?? email).trim().toLowerCase();
    const displayName = fullName || (member as { full_name?: string | null }).full_name || memberEmail.split("@")[0] || "User";

    let authUserId = (member as { auth_user_id?: string | null }).auth_user_id ?? null;
    if (!authUserId) {
      authUserId = await findExistingAuthUserIdByEmail(memberEmail);
    }

    if (authUserId) {
      const { error: updateUserError } = await service.auth.admin.updateUserById(authUserId, {
        email: memberEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: displayName }
      });
      if (updateUserError) {
        return NextResponse.json({ message: updateUserError.message || "Could not update account." }, { status: 500 });
      }
    } else {
      const { data: createdUser, error: createUserError } = await service.auth.admin.createUser({
        email: memberEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: displayName }
      });
      if (createUserError || !createdUser.user) {
        return NextResponse.json({ message: createUserError?.message || "Could not create account." }, { status: 500 });
      }
      authUserId = createdUser.user.id;
    }

    const { error: profileError } = await service
      .from("profiles")
      .update({
        auth_user_id: authUserId,
        email: memberEmail,
        full_name: displayName,
        status: "active",
        invite_status: "accepted",
        invite_token_hash: null,
        invite_expires_at: null,
        activated_at: new Date().toISOString()
      })
      .eq("id", member.id);

    if (profileError) {
      return NextResponse.json({ message: profileError.message || "Could not activate invite." }, { status: 500 });
    }

    // Persist consent decision (GDPR basics)
    try {
      await service.from("user_consents").insert({
        auth_user_id: authUserId,
        consent_type: "terms_privacy",
        consent_value: true,
        metadata: { source: "invite_activation" }
      });
    } catch {
      // non-blocking
    }

    const cookieStore = await cookies();
    const routeClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const { error: signInError } = await routeClient.auth.signInWithPassword({
      email: memberEmail,
      password
    });

    if (signInError) {
      return NextResponse.json({
        ok: true,
        loginRequired: true,
        message: "Account activated. Please sign in with your new password."
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[member-invites/activate]", error);
    return NextResponse.json({ message: "An unexpected error occurred." }, { status: 500 });
  }
}
