import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "nodejs";

/** Returns org name and settings (including enabled modules) for sidebar/dashboard. */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ message: "slug required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: org, error } = await supabase
    .from("organizations")
    .select("name, settings")
    .or(`slug.eq."${slug.replace(/"/g, '""')}",subdomain.eq."${slug.replace(/"/g, '""')}"`)
    .eq("is_active", true)
    .single();

  if (error || !org) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const o = org as { name: string; settings?: Record<string, unknown> };
  const settings = o.settings ?? {};
  const features = (settings.features as Record<string, boolean>) ?? {};
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
  });
}
