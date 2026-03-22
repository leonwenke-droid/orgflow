import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ items: [], unreadCount: 0 }, { status: 401 });
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id);
  const ids = (profiles ?? []).map((p: { id: string }) => p.id);
  if (ids.length === 0) {
    return NextResponse.json({ items: [], unreadCount: 0 });
  }

  const { data: items, error } = await supabase
    .from("user_notifications")
    .select("id, type, title, body, link, read_at, created_at, organization_id")
    .in("profile_id", ids)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[notifications GET]", error);
    return NextResponse.json({ items: [], unreadCount: 0, error: error.message }, { status: 500 });
  }

  const list = items ?? [];
  const unreadCount = list.filter((n: { read_at: string | null }) => !n.read_at).length;
  return NextResponse.json({ items: list, unreadCount });
}

export async function PATCH(req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: { ids?: string[]; markAllRead?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { data: profiles } = await supabase.from("profiles").select("id").eq("auth_user_id", user.id);
  const profileIds = (profiles ?? []).map((p: { id: string }) => p.id);
  if (profileIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const now = new Date().toISOString();

  if (body.markAllRead) {
    const { error } = await supabase
      .from("user_notifications")
      .update({ read_at: now })
      .in("profile_id", profileIds)
      .is("read_at", null);
    if (error) {
      console.error("[notifications PATCH markAll]", error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const ids = (body.ids ?? []).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: now })
    .in("id", ids)
    .in("profile_id", profileIds);

  if (error) {
    console.error("[notifications PATCH]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
