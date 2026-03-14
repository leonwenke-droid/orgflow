import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";
import { isOrgAdmin } from "../../../../lib/getOrganization";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Sign in required." }, { status: 401 });
    }

    const body = await req.json();
    const organizationId = (body.organizationId as string)?.trim();
    const name = (body.name as string)?.trim();
    const slug = (body.slug as string)?.trim();
    const start_date = (body.start_date as string)?.trim() || null;
    const end_date = (body.end_date as string)?.trim() || null;

    if (!organizationId || !name) {
      return NextResponse.json({ message: "Organization and name required." }, { status: 400 });
    }

    if (!(await isOrgAdmin(organizationId))) {
      return NextResponse.json({ message: "Not allowed to create events for this organisation." }, { status: 403 });
    }

    const service = createSupabaseServiceRoleClient();
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 50);
    const { data: event, error } = await service
      .from("events")
      .insert({
        organization_id: organizationId,
        name,
        slug: finalSlug,
        start_date: start_date || null,
        end_date: end_date || null,
      })
      .select("id, name, slug")
      .single();

    if (error) {
      console.error("[events/create]", error);
      return NextResponse.json({ message: error.message || "Failed to create event." }, { status: 500 });
    }

    return NextResponse.json(event);
  } catch (e) {
    console.error("[events/create]", e);
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}
