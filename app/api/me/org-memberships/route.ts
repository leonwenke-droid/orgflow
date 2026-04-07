import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getOrganizationsForCurrentUser } from "../../../../lib/getOrganization";

/**
 * Returns how many organisations the signed-in user belongs to (for UI: sidebar link to /dashboard).
 */
export async function GET() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ count: 0 }, { status: 401 });
  }
  const orgs = await getOrganizationsForCurrentUser();
  return NextResponse.json({ count: orgs.length });
}
