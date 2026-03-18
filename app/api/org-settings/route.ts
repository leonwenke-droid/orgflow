import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getOrgIdForData } from "../../../lib/getOrganization";
import { canViewFinance } from "../../../lib/permissions";
import type { DbRole } from "../../../types";

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
  const orgIdForData = getOrgIdForData(slug, o.id);

  let role: DbRole | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_user_id", user.id)
      .eq("organization_id", orgIdForData)
      .maybeSingle();
    role = (profile as { role?: DbRole } | null)?.role ?? null;
  }

  return NextResponse.json({
    name: typeof o.name === "string" ? o.name.trim() : o.name,
    settings,
    modules: {
      tasks: features.tasks !== false,
      shifts: features.shifts !== false,
      finance: features.treasury !== false,
      resources: (features.resources ?? features.materials ?? true) !== false,
      engagement: features.engagement_tracking !== false,
      events: features.events === true,
    },
    role: role ?? undefined,
    // Rolle unbekannt (null) → Finanzen anzeigen (Fail-open), damit Admins nicht ausgesperrt werden
    canViewFinance: !user ? false : (role == null || canViewFinance(role)),
  });
}
