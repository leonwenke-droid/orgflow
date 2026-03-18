import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const reason = String(body.reason ?? "").trim().slice(0, 500);

  const service = createSupabaseServiceRoleClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, organization_id, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ message: "Profile not found." }, { status: 404 });
  if ((profile as { status?: string | null }).status === "disabled") {
    return NextResponse.json({ message: "Account disabled." }, { status: 403 });
  }

  const { error } = await service.from("deletion_requests").insert({
    organization_id: (profile as { organization_id: string }).organization_id,
    profile_id: (profile as { id: string }).id,
    status: "pending",
    reason: reason || null
  });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

