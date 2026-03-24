import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getOrgIdForData } from "../../../lib/getOrganization";
import { canViewFinance, canManageOrg, isReadOnly } from "../../../lib/permissions";
import type { DbRole } from "../../../types";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";

export const runtime = "nodejs";

/** Returns org name, settings (including enabled modules), and current user role for sidebar/dashboard. */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ message: "slug required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();
  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, name, settings, slug")
    .or(`slug.eq."${slug.replace(/"/g, '""')}",subdomain.eq."${slug.replace(/"/g, '""')}"`)
    .eq("is_active", true)
    .single();

  if (error || !org) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const o = org as { id: string; name: string; settings?: Record<string, unknown>; slug?: string };
  const settings = o.settings ?? {};
  const features = (settings.features as Record<string, boolean>) ?? {};
  const branding = (settings.branding as { logo_url?: string } | undefined) ?? {};
  const logoUrl =
    typeof branding.logo_url === "string" && branding.logo_url.trim() ? branding.logo_url.trim() : undefined;
  const orgIdForData = getOrgIdForData(slug, o.id);

  let role: DbRole | null = null;
  if (user) {
    // Use service role for reliable role lookup (prevents UI flipping to admin modules on role=null)
    try {
      const service = createSupabaseServiceRoleClient();

      const { data: profilePrimary } = await service
        .from("profiles")
        .select("role")
        .eq("auth_user_id", user.id)
        .eq("organization_id", orgIdForData)
        .maybeSingle();

      // Legacy: if the profile is not stored under orgIdForData (mapped),
      // try again under the raw org.id.
      const shouldFallbackToRawOrg = !profilePrimary && orgIdForData !== o.id;
      const { data: profileFallback } = shouldFallbackToRawOrg
        ? await service
            .from("profiles")
            .select("role")
            .eq("auth_user_id", user.id)
            .eq("organization_id", o.id)
            .maybeSingle()
        : { data: null };

      role = ((profilePrimary ?? profileFallback) as { role?: DbRole } | null)?.role ?? null;
    } catch {
      const { data: profilePrimary } = await supabase
        .from("profiles")
        .select("role")
        .eq("auth_user_id", user.id)
        .eq("organization_id", orgIdForData)
        .maybeSingle();

      const shouldFallbackToRawOrg = !profilePrimary && orgIdForData !== o.id;
      const { data: profileFallback } = shouldFallbackToRawOrg
        ? await supabase
            .from("profiles")
            .select("role")
            .eq("auth_user_id", user.id)
            .eq("organization_id", o.id)
            .maybeSingle()
        : { data: null };

      role = ((profilePrimary ?? profileFallback) as { role?: DbRole } | null)?.role ?? null;
    }
  }

  return NextResponse.json({
    name: typeof o.name === "string" ? o.name.trim() : o.name,
    settings,
    logoUrl,
    modules: {
      tasks: features.tasks !== false,
      shifts: features.shifts !== false,
      finance: features.treasury !== false,
      resources: (features.resources ?? features.materials ?? true) !== false,
      engagement: features.engagement_tracking !== false,
      events: features.events !== false,
    },
    role: role ?? undefined,
    canManageOrg: role != null ? canManageOrg(role) : false,
    isReadOnly: role != null ? isReadOnly(role) : false,
    canViewFinance: role != null ? canViewFinance(role) : false,
  });
}
