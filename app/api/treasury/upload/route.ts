import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { DEFAULT_CURRENCY, formatCurrency, parseTreasuryAmount } from "../../../../lib/currency";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { canViewFinance } from "../../../../lib/permissions";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const mode = (formData.get("mode")?.toString() || "excel").toLowerCase();

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Sign in required.", errorKey: "tasks.not_logged_in" }, { status: 401 });
    }

    const organizationId = formData.get("organization_id")?.toString() || null;
    if (!organizationId) {
      return NextResponse.json({ message: "organization_id required." }, { status: 400 });
    }

    const service = createSupabaseServiceRoleClient();
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

    if (!profile || profile.status === "disabled" || !canViewFinance((profile as { role?: any }).role)) {
      return NextResponse.json({ message: "Forbidden", errorKey: "common.unauthorized" }, { status: 403 });
    }

    if ((profile as { organization_id?: string | null }).organization_id !== organizationId && (profile as { role?: string }).role !== "super_admin") {
      return NextResponse.json({ message: "Forbidden", errorKey: "common.unauthorized" }, { status: 403 });
    }

    let currencyCode = DEFAULT_CURRENCY;
    if (organizationId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", organizationId)
        .maybeSingle();
      currencyCode = ((org?.settings as { currency?: string } | null)?.currency ?? DEFAULT_CURRENCY) as string;
    }

    if (mode === "manual") {
      const rawAmount = formData.get("amount");
      if (!rawAmount) {
        return NextResponse.json(
          { message: "Kein Betrag übermittelt." },
          { status: 400 }
        );
      }
      const amount = parseTreasuryAmount(String(rawAmount).trim());
      if (Number.isNaN(amount)) {
        return NextResponse.json(
          { message: "Der eingegebene Betrag ist keine gültige Zahl." },
          { status: 400 }
        );
      }

      const { error } = await supabase.from("treasury_updates").insert({
        amount,
        source: "Manuelle Eingabe",
        organization_id: organizationId
      });

      if (error) {
        console.error(error);
        return NextResponse.json(
          { message: "Error saving to database.", errorKey: "finance.db_error" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: `Kassenstand manuell auf ${formatCurrency(amount, "de-DE", currencyCode)} gesetzt.`
      });
    }

    // Excel-Upload
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { message: "Keine Datei übermittelt." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const cellRefRaw = formData.get("cell_ref")?.toString().trim().toUpperCase();
    const cellRef = cellRefRaw || (process.env.TREASURY_EXCEL_CELL ?? "M9");
    const cell = sheet[cellRef];

    if (!cell || typeof cell.v === "undefined") {
      return NextResponse.json(
        { message: `Keine Zahl in Zelle ${cellRef} gefunden.` },
        { status: 400 }
      );
    }

    const amount = Number(cell.v);
    if (Number.isNaN(amount)) {
      return NextResponse.json(
        { message: `Wert in ${cellRef} ist keine Zahl.` },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("treasury_updates").insert({
      amount,
      source: `Excel Upload (${cellRef})`,
      organization_id: organizationId
    });

    if (error) {
      console.error(error);
      return NextResponse.json(
        { message: "Error saving to database.", errorKey: "finance.db_error" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Kassenstand aus Zelle ${cellRef} auf ${formatCurrency(amount, "de-DE", currencyCode)} gesetzt.`
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: "Unexpected upload error.", errorKey: "finance.upload_error" },
      { status: 500 }
    );
  }
}

