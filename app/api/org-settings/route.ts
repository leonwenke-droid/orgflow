import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { fetchActiveOrganizationBySlug, getOrgIdForData, resolveMemberProfileForOrganization } from "../../../lib/getOrganization";
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
  const resolved = await fetchActiveOrganizationBySlug(slug);

  if (!resolved) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const o = {
    id: resolved.id,
    name: resolved.name,
    settings: (resolved.settings ?? {}) as Record<string, unknown>,
    slug: resolved.slug
  };
  const settings = o.settings ?? {};
  const features = (settings.features as Record<string, boolean>) ?? {};
  const branding = (settings.branding as { logo_url?: string } | undefined) ?? {};
  const logoUrl =
    typeof branding.logo_url === "string" && branding.logo_url.trim() ? branding.logo_url.trim() : undefined;
  const orgIdForData = getOrgIdForData(slug, o.id);
  const plan = String((resolved as any)?.plan ?? "free").trim() as "free" | "team" | "pro";
  const paid = plan !== "free";

  let role: DbRole | null = null;
  let profileId: string | null = null;
  if (user) {
    const member = await resolveMemberProfileForOrganization(user.id, slug, resolved);
    role = (member?.role ?? null) as DbRole | null;
    profileId = member?.id ?? null;
    // Nur Plattform-Accounts (global); Org-Admins kommen immer über `member.role` oben.
    if (role == null) {
      const { data: isPlatformSuperAdmin } = await supabase.rpc("is_super_admin");
      if (isPlatformSuperAdmin === true) role = "super_admin";
    }
  }

  let openTaskCount = 0;
  let upcomingShiftCount = 0;
  if (user && profileId && orgIdForData) {
    try {
      const service = createSupabaseServiceRoleClient();
      const { count } = await service
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgIdForData)
        .eq("owner_id", profileId)
        .neq("status", "erledigt");
      openTaskCount = count ?? 0;
    } catch {
      openTaskCount = 0;
    }

    try {
      const service = createSupabaseServiceRoleClient();
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await service
        .from("shift_assignments")
        .select("id, shifts!inner(date, deleted_at, organization_id)", { count: "exact", head: true })
        .eq("shifts.organization_id", orgIdForData)
        .is("shifts.deleted_at", null)
        .gte("shifts.date", today)
        // "Assigned to me" includes replacements as well.
        .or(`user_id.eq.${profileId},replacement_user_id.eq.${profileId}`);
      upcomingShiftCount = count ?? 0;
    } catch {
      upcomingShiftCount = 0;
    }
  }

  return NextResponse.json({
    name: typeof o.name === "string" ? o.name.trim() : o.name,
    settings,
    logoUrl,
    modules: {
      tasks: features.tasks !== false,
      shifts: features.shifts !== false,
      finance: paid && features.treasury !== false,
      resources: paid && (features.resources ?? features.materials ?? true) !== false,
      engagement: paid && features.engagement_tracking !== false,
      events: paid && features.events !== false,
    },
    role: role ?? undefined,
    canManageOrg: role != null ? canManageOrg(role) : false,
    isReadOnly: role != null ? isReadOnly(role) : false,
    canViewFinance: role != null ? canViewFinance(role) : false,
    openTaskCount,
    upcomingShiftCount,
  });
}
