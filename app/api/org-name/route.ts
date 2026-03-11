import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "nodejs";

/**
 * Öffentlicher Abruf des Organisationsnamens anhand des Slugs (für Header).
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ message: "slug required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: org, error } = await supabase
    .from("organizations")
    .select("name")
    .or(`slug.eq."${slug.replace(/"/g, '""')}",subdomain.eq."${slug.replace(/"/g, '""')}"`)
    .eq("is_active", true)
    .single();

  if (error || !org) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const name = (org as { name: string }).name;
  return NextResponse.json({ name: typeof name === "string" ? name.trim() : name });
}
