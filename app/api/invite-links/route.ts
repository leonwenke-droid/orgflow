import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentOrganization, isOrgAdmin } from "../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { generateInviteToken } from "../../../services/inviteService";

function getBaseUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  return fromEnv || "http://localhost:3000";
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Sign in required." }, { status: 401 });
    }

    const body = await req.json();
    const orgSlug = (body.orgSlug as string)?.trim();
    const expiresInDays = typeof body.expiresInDays === "number" ? body.expiresInDays : 7;

    if (!orgSlug) {
      return NextResponse.json({ message: "orgSlug required." }, { status: 400 });
    }

    const org = await getCurrentOrganization(orgSlug);
    if (!(await isOrgAdmin(org.id))) {
      return NextResponse.json({ message: "Admin access required." }, { status: 403 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const service = createSupabaseServiceRoleClient();
    const { data: link, error } = await service
      .from("invite_links")
      .insert({
        organization_id: org.id,
        token,
        created_by: profile?.id ?? null,
        expires_at: expiresAt.toISOString(),
        max_uses: 10,
      })
      .select("id, token, expires_at")
      .single();

    if (error || !link) {
      return NextResponse.json({ message: error?.message || "Failed to create invite." }, { status: 500 });
    }

    const url = `${getBaseUrl()}/join/${orgSlug}?token=${encodeURIComponent(link.token)}`;
    return NextResponse.json({ url, token: link.token, expiresAt: link.expires_at });
  } catch (e) {
    console.error("invite-links error:", e);
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}
