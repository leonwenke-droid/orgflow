import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { canViewFinance } from "../../../../lib/permissions";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const organizationId = String(url.searchParams.get("organization_id") ?? "").trim();
  if (!organizationId) return NextResponse.json({ message: "organization_id required." }, { status: 400 });

  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const service = createSupabaseServiceRoleClient();
  const { data: orgRow } = await service
    .from("organizations")
    .select("plan")
    .eq("id", organizationId)
    .maybeSingle();
  if (String((orgRow as any)?.plan ?? "free") === "free") {
    return NextResponse.json({ message: "Finance is not available on Starter." }, { status: 403 });
  }
  const { data: profileInOrg } = await service
    .from("profiles")
    .select("role, organization_id, status")
    .eq("auth_user_id", user.id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  const { data: superRows } = !profileInOrg
    ? await service
        .from("profiles")
        .select("role, organization_id, status")
        .eq("auth_user_id", user.id)
        .eq("role", "super_admin")
        .limit(1)
    : { data: null };
  const profile = (profileInOrg ?? (superRows?.[0] ?? null)) as
    | { role?: string; organization_id?: string | null; status?: string | null }
    | null;

  if (!profile || profile.status === "disabled" || !canViewFinance((profile as any).role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  if ((profile as any).organization_id !== organizationId && (profile as any).role !== "super_admin") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { data: rows, error } = await supabase
    .from("treasury_entries")
    .select("date, type, category, description, amount_cents, created_at")
    .eq("organization_id", organizationId)
    .order("date", { ascending: false })
    .limit(5000);
  if (error) return NextResponse.json({ message: error.message }, { status: 400 });

  const header = ["date", "type", "category", "description", "amount_cents", "created_at"];
  const lines = [
    header.join(","),
    ...(rows ?? []).map((r: any) => header.map((k) => csvEscape(r[k])).join(","))
  ];
  const csv = lines.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="treasury-entries-${organizationId}.csv"`
    }
  });
}

