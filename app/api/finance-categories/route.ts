import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { isSuperAdmin } from "../../../lib/getOrganization";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";

export const runtime = "nodejs";

function isMissingFinanceCategoriesTable(message: string): boolean {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("finance_categories") &&
    (m.includes("does not exist") ||
      m.includes("could not find the table") ||
      m.includes("schema cache"))
  );
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const organizationId = String(body.organizationId ?? "").trim();
    const categories = Array.isArray(body.categories) ? body.categories : null;
    if (!organizationId || !categories) {
      return NextResponse.json({ message: "organizationId and categories required." }, { status: 400 });
    }

    const superAdmin = await isSuperAdmin();
    if (!superAdmin) {
      const { data: ok } = await supabase.rpc("is_org_admin", { org_id: organizationId });
      if (ok !== true) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const service = createSupabaseServiceRoleClient();
    const rows = categories
      .map((c: any) => ({
        organization_id: organizationId,
        key: String(c.key ?? "").trim(),
        name: String(c.name ?? "").trim(),
        enabled: c.enabled === false ? false : true
      }))
      .filter((r: any) => r.key && r.name);

    if (rows.length === 0) return NextResponse.json({ message: "No valid categories." }, { status: 400 });

    const { error } = await service
      .from("finance_categories")
      .upsert(rows, { onConflict: "organization_id,key" });
    if (error) {
      const message = error.message || "Save failed.";
      if (isMissingFinanceCategoriesTable(message)) {
        return NextResponse.json(
          {
            message:
              "Finance categories are not initialized in this database yet. Apply migrations (including 20260322004000_finance_categories.sql) and try again."
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[finance-categories]", e);
    return NextResponse.json({ message: "An error occurred." }, { status: 500 });
  }
}

