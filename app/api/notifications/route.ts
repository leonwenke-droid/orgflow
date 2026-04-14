import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import {
  fetchActiveOrganizationBySlug,
  getOrgIdForData,
  pickProfileForOrgAccess
} from "../../../lib/getOrganization";

export const dynamic = "force-dynamic";

/** Ein Eintrag pro Organisation: `organization_id` kann kanonische oder Daten-Ebene-ID sein. */
function orgIdCandidatesForSlug(orgSlug: string, org: { id: string }) {
  const dataId = getOrgIdForData(orgSlug, org.id);
  return [...new Set([org.id, dataId].filter(Boolean))];
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ items: [], unreadCount: 0 }, { status: 401 });
  }

  const orgSlug = req.nextUrl.searchParams.get("org")?.trim() ?? "";
  if (!orgSlug) {
    return NextResponse.json({ items: [], unreadCount: 0 });
  }

  const org = await fetchActiveOrganizationBySlug(orgSlug);
  if (!org) {
    return NextResponse.json({ items: [], unreadCount: 0 });
  }

  const orgIds = orgIdCandidatesForSlug(orgSlug, org);

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, organization_id, status")
    .eq("auth_user_id", user.id);

  const profile = pickProfileForOrgAccess(profileRows, orgSlug, org);
  if (!profile) {
    return NextResponse.json({ items: [], unreadCount: 0 });
  }

  const { data: items, error } = await supabase
    .from("user_notifications")
    .select("id, type, title, body, link, read_at, created_at, organization_id")
    .eq("profile_id", profile.id)
    .in("organization_id", orgIds)
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

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const orgSlug = req.nextUrl.searchParams.get("org")?.trim() ?? "";
  if (!orgSlug) {
    return NextResponse.json({ ok: false, error: "org_required" }, { status: 400 });
  }

  const org = await fetchActiveOrganizationBySlug(orgSlug);
  if (!org) {
    return NextResponse.json({ ok: false, error: "org_not_found" }, { status: 404 });
  }

  const orgIds = orgIdCandidatesForSlug(orgSlug, org);

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, organization_id, status")
    .eq("auth_user_id", user.id);

  const profile = pickProfileForOrgAccess(profileRows, orgSlug, org);
  if (!profile) {
    return NextResponse.json({ ok: true });
  }

  let body: { ids?: string[]; markAllRead?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (body.markAllRead) {
    const { error } = await supabase
      .from("user_notifications")
      .update({ read_at: now })
      .eq("profile_id", profile.id)
      .in("organization_id", orgIds)
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
    .eq("profile_id", profile.id)
    .in("organization_id", orgIds);

  if (error) {
    console.error("[notifications PATCH]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
