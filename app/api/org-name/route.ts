import { NextRequest, NextResponse } from "next/server";
import { fetchActiveOrganizationBySlug } from "../../../lib/getOrganization";

export const runtime = "nodejs";

/**
 * Öffentlicher Abruf des Organisationsnamens anhand des Slugs (für Header).
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ message: "slug required" }, { status: 400 });
  }

  const org = await fetchActiveOrganizationBySlug(slug);

  if (!org) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const name = org.name;
  return NextResponse.json({ name: typeof name === "string" ? name.trim() : name });
}
