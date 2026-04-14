import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isActiveProfileStatus(status: string | null | undefined): boolean {
  return (status ?? "active") !== "disabled";
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured." }, { status: 500 });
  }
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const service = createSupabaseServiceRoleClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error: fetchErr } = await service
    .from("deletion_requests")
    .select("id, profile_id, organization_id, created_at")
    .eq("status", "pending")
    .lt("created_at", cutoff);

  if (fetchErr) {
    return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 });
  }

  const list = rows ?? [];
  let processed = 0;
  const errors: string[] = [];

  for (const row of list) {
    const requestId = String((row as { id?: string }).id ?? "");
    const profileId = String((row as { profile_id?: string }).profile_id ?? "");
    if (!requestId || !profileId) continue;

    try {
      const { data: profile, error: profErr } = await service
        .from("profiles")
        .select("id, auth_user_id, organization_id")
        .eq("id", profileId)
        .maybeSingle();

      if (profErr) throw new Error(profErr.message);
      if (!profile) {
        await service
          .from("deletion_requests")
          .update({ status: "completed", resolved_at: new Date().toISOString() })
          .eq("id", requestId);
        processed += 1;
        continue;
      }

      const authUserId = (profile as { auth_user_id?: string | null }).auth_user_id ?? null;

      const { error: wipeErr } = await service
        .from("profiles")
        .update({
          status: "disabled",
          full_name: "Gelöschtes Profil",
          email: null,
          phone: null
        })
        .eq("id", profileId);

      if (wipeErr) throw new Error(wipeErr.message);

      if (authUserId) {
        const { data: siblings, error: sibErr } = await service
          .from("profiles")
          .select("id, status")
          .eq("auth_user_id", authUserId)
          .neq("id", profileId);

        if (sibErr) throw new Error(sibErr.message);

        const hasOtherActive = (siblings ?? []).some((p) =>
          isActiveProfileStatus((p as { status?: string | null }).status)
        );

        if (!hasOtherActive) {
          const { error: delErr } = await service.auth.admin.deleteUser(authUserId);
          if (delErr) throw new Error(delErr.message);
        }
      }

      const { error: updReqErr } = await service
        .from("deletion_requests")
        .update({ status: "completed", resolved_at: new Date().toISOString() })
        .eq("id", requestId);

      if (updReqErr) throw new Error(updReqErr.message);
      processed += 1;
    } catch (e) {
      errors.push(`${requestId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    pendingFound: list.length,
    processed,
    errors: errors.length ? errors : undefined
  });
}
