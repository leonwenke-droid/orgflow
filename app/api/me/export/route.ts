import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, status, organization_id, created_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ message: "Profile not found." }, { status: 404 });

  const orgId = (profile as { organization_id: string }).organization_id;
  const profileId = (profile as { id: string }).id;

  const [assignmentsRes, eventsRes, tasksRes, consentsRes] = await Promise.all([
    supabase
      .from("shift_assignments")
      .select("id, shift_id, status, replacement_user_id, created_at")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("engagement_events")
      .select("id, event_type, points, created_at, source_id")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("tasks")
      .select("id, title, status, due_at, owner_id, created_at")
      .eq("organization_id", orgId)
      .eq("owner_id", profileId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("user_consents")
      .select("id, consent_type, consent_value, metadata, created_at")
      .eq("auth_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    profile,
    shift_assignments: assignmentsRes.data ?? [],
    engagement_events: eventsRes.data ?? [],
    owned_tasks: tasksRes.data ?? [],
    consents: consentsRes.data ?? [],
  };

  const filename = `orgflow-export-${profileId}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}

