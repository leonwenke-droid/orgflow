import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentOrganization, isOrgAdmin } from "../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { generateInviteToken } from "../../../services/inviteService";
import { getPublicBaseUrl } from "../../../lib/publicBaseUrl";
import { asInt, asTrimmedString, clampInt, readJson } from "../../../lib/validation";
import { checkRateLimit } from "../../../lib/rateLimit";
import { getClientIp, getRequestId, log } from "../../../lib/log";
import { canAddMember } from "../../../lib/planLimits";

export async function POST(req: Request) {
  try {
    const requestId = getRequestId(req);
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Sign in required." }, { status: 401 });
    }

    const parsed = await readJson<{ orgSlug?: unknown; expiresInDays?: unknown }>(req);
    if (!parsed.ok) {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }
    const orgSlug = asTrimmedString(parsed.data.orgSlug);
    const expiresInDays = clampInt(asInt(parsed.data.expiresInDays, 7), 1, 30);

    if (!orgSlug) {
      return NextResponse.json({ message: "orgSlug required." }, { status: 400 });
    }

    const ip = getClientIp(req);
    const rl = checkRateLimit(`invite_links:create:${ip}:${orgSlug.toLowerCase()}`, 10);
    if (!rl.ok) {
      log("warn", "rate_limit", { requestId, route: "invite-links", ip, key: "invite-links" });
      return NextResponse.json(
        { message: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const org = await getCurrentOrganization(orgSlug);
    if (!(await isOrgAdmin(org.id, orgSlug))) {
      return NextResponse.json({ message: "Admin access required." }, { status: 403 });
    }

    const service = createSupabaseServiceRoleClient();
    const { count } = await service
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", org.id);
    const memberCount = count ?? 0;
    const orgPlan = (org.plan ?? "free") as "free" | "team" | "pro";
    if (!canAddMember(orgPlan, memberCount)) {
      return NextResponse.json(
        { message: "Member limit reached for your plan.", errorKey: "members.error_member_limit" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

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

    const url = `${await getPublicBaseUrl()}/join/${orgSlug}?token=${encodeURIComponent(link.token)}`;
    return NextResponse.json({ url, token: link.token, expiresAt: link.expires_at });
  } catch (e) {
    log("error", "invite_links_error", { requestId: getRequestId(req), route: "invite-links", error: String(e) });
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}
