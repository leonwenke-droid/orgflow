import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { getRequestId, log } from "../../../lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const startedAt = Date.now();
  try {
    const service = createSupabaseServiceRoleClient();
    const { error } = await service.from("organizations").select("id").limit(1);
    if (error) {
      log("error", "health_db_error", { requestId, error: error.message });
      return NextResponse.json({ ok: false, db: "error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, db: "ok", durationMs: Date.now() - startedAt });
  } catch (e) {
    log("error", "health_unexpected", { requestId, error: String(e) });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

