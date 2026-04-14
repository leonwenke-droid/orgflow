import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getCurrentOrganization } from "../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { checkRateLimit } from "../../../lib/rateLimit";
import { asTrimmedString, readJson } from "../../../lib/validation";
import { canAddMember } from "../../../lib/planLimits";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Sign in required." }, { status: 401 });
    }

    const parsed = await readJson<{ orgSlug?: unknown; token?: unknown }>(req);
    if (!parsed.ok) {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }
    const orgSlug = asTrimmedString(parsed.data.orgSlug);
    const token = asTrimmedString(parsed.data.token);

    if (!orgSlug || !token) {
      return NextResponse.json({ message: "orgSlug and token required." }, { status: 400 });
    }

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
    const rl = await checkRateLimit(`invite_links:join:${ip}:${orgSlug.toLowerCase()}`, 30);
    if (!rl.ok) {
      return NextResponse.json(
        { message: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const org = await getCurrentOrganization(orgSlug);
    const service = createSupabaseServiceRoleClient();

    const { data: invite } = await service
      .from("invite_links")
      .select("id, organization_id, use_count, max_uses, expires_at")
      .eq("token", token)
      .eq("organization_id", org.id)
      .single();

    if (!invite) {
      return NextResponse.json({ message: "Invalid or expired invite." }, { status: 400 });
    }

    const expired = invite.expires_at && new Date(invite.expires_at) < new Date();
    const maxedOut = invite.max_uses != null && (invite.use_count ?? 0) >= invite.max_uses;
    if (expired || maxedOut) {
      return NextResponse.json({ message: "Invite has expired or reached max uses." }, { status: 400 });
    }

    const { data: profile } = await service
      .from("profiles")
      .select("id, organization_id")
      .eq("auth_user_id", user.id)
      .single();

    const { count } = await service
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", org.id);
    const memberCount = count ?? 0;
    const orgPlan = (org.plan ?? "free") as "free" | "team" | "pro";

    if (profile) {
      const currentOrgId = String(profile.organization_id ?? "").trim();
      if (currentOrgId !== org.id && !canAddMember(orgPlan, memberCount)) {
        return NextResponse.json({ message: "Member limit reached for your plan.", errorKey: "members.error_member_limit" }, { status: 400 });
      }
      await service
        .from("profiles")
        .update({ organization_id: org.id })
        .eq("id", profile.id);
    } else {
      if (!canAddMember(orgPlan, memberCount)) {
        return NextResponse.json({ message: "Member limit reached for your plan.", errorKey: "members.error_member_limit" }, { status: 400 });
      }
      await service.from("profiles").insert({
        id: randomUUID(),
        auth_user_id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        email: user.email,
        role: "member",
        organization_id: org.id,
      });
    }

    await service
      .from("invite_links")
      .update({ use_count: (invite.use_count ?? 0) + 1 })
      .eq("id", invite.id);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("join-org error:", e);
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}
