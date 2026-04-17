import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const service = createSupabaseServiceRoleClient();
  const { data: profiles, error: profErr } = await service
    .from("profiles")
    .select("id, full_name, email, phone, role, status, organization_id, created_at")
    .eq("auth_user_id", user.id)
    .order("created_at", { ascending: true });

  if (profErr) {
    return NextResponse.json({ message: profErr.message }, { status: 500 });
  }
  if (!profiles?.length) return NextResponse.json({ message: "Profile not found." }, { status: 404 });

  const profileIds = profiles.map((p) => p.id as string);

  const [assignmentsRes, eventsRes, tasksRes, consentsRes] = await Promise.all([
    service
      .from("shift_assignments")
      .select("id, shift_id, status, replacement_user_id, created_at")
      .in("user_id", profileIds)
      .order("created_at", { ascending: false })
      .limit(500),
    service
      .from("engagement_events")
      .select("id, event_type, points, created_at, source_id")
      .in("user_id", profileIds)
      .order("created_at", { ascending: false })
      .limit(1000),
    service
      .from("tasks")
      .select("id, title, status, due_at, owner_id, organization_id, created_at")
      .in("owner_id", profileIds)
      .order("created_at", { ascending: false })
      .limit(500),
    service
      .from("user_consents")
      .select("id, consent_type, consent_value, metadata, created_at")
      .eq("auth_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200)
  ]);

  const primary = profiles[0] as { id: string };
  const payload = {
    exported_at: new Date().toISOString(),
    profiles,
    profile: primary,
    shift_assignments: assignmentsRes.data ?? [],
    engagement_events: eventsRes.data ?? [],
    owned_tasks: tasksRes.data ?? [],
    consents: consentsRes.data ?? []
  };

  const filename = `orgflow-export-${primary.id}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`
    }
  });
}
