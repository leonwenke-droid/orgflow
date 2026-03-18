import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createSupabaseServiceRoleClient } from "../../../../../lib/supabaseServer";
import { getCurrentOrganization, getOrgIdForData, isOrgAdmin } from "../../../../../lib/getOrganization";
import { buildInviteUrl, buildWhatsAppInviteText, generateInviteToken, hashInviteToken, inviteExpiresAt } from "../../../../../lib/memberInvites";

function getBaseUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  return fromEnv || "http://localhost:3000";
}

function csvEscape(value: string | null | undefined): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgSlug = (url.searchParams.get("orgSlug") ?? "").trim();
  if (!orgSlug) {
    return NextResponse.json({ message: "orgSlug required." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const org = await getCurrentOrganization(orgSlug);
  const orgIdForData = getOrgIdForData(orgSlug, org.id);
  if (!(await isOrgAdmin(orgIdForData))) {
    return NextResponse.json({ message: "Forbidden", errorKey: "common.unauthorized" }, { status: 403 });
  }

  const service = createSupabaseServiceRoleClient();
  const { data: members } = await service
    .from("profiles")
    .select("id, full_name, email, phone, status, invite_status")
    .eq("organization_id", orgIdForData)
    .eq("status", "invited")
    .order("full_name");

  const expiresAt = inviteExpiresAt();
  const rows = ["name,email,phone,invite_url,whatsapp_text,expires_at"];

  for (const member of members ?? []) {
    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    await service
      .from("profiles")
      .update({
        invite_token_hash: tokenHash,
        invite_expires_at: expiresAt.toISOString(),
        invite_status: "pending"
      })
      .eq("id", (member as { id: string }).id)
      .eq("organization_id", orgIdForData);

    const inviteUrl = buildInviteUrl(getBaseUrl(), token);
    const whatsappText = buildWhatsAppInviteText({
      firstName: (member as { full_name?: string | null }).full_name?.split(" ")?.[0] ?? null,
      organizationName: org.name,
      inviteUrl
    });

    rows.push([
      csvEscape((member as { full_name?: string | null }).full_name ?? ""),
      csvEscape((member as { email?: string | null }).email ?? ""),
      csvEscape((member as { phone?: string | null }).phone ?? ""),
      csvEscape(inviteUrl),
      csvEscape(whatsappText),
      csvEscape(expiresAt.toISOString())
    ].join(","));
  }

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${orgSlug}-pending-invites.csv"`
    }
  });
}
