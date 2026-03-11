import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const mode = (formData.get("mode")?.toString() || "excel").toLowerCase();

    const supabase = createSupabaseServiceRoleClient();
    const organizationId = formData.get("organization_id")?.toString() || null;

    if (mode === "manual") {
      const rawAmount = formData.get("amount");
      if (!rawAmount) {
        return NextResponse.json(
          { message: "Kein Betrag übermittelt." },
          { status: 400 }
        );
      }
      const normalized = String(rawAmount).replace(/\./g, "").replace(",", ".");
      const amount = Number(normalized);
      if (Number.isNaN(amount)) {
        return NextResponse.json(
          { message: "Der eingegebene Betrag ist keine gültige Zahl." },
          { status: 400 }
        );
      }

      const { error } = await supabase.from("treasury_updates").insert({
        amount,
        source: "Manuelle Eingabe",
        ...(organizationId ? { organization_id: organizationId } : {})
      });

      if (error) {
        console.error(error);
        return NextResponse.json(
          { message: "Fehler beim Speichern in der Datenbank." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: `Kassenstand manuell auf ${amount.toLocaleString("de-DE")} € gesetzt.`
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
      ...(organizationId ? { organization_id: organizationId } : {})
    });

    if (error) {
      console.error(error);
      return NextResponse.json(
        { message: "Fehler beim Speichern in der Datenbank." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Kassenstand aus Zelle ${cellRef} auf ${amount.toLocaleString("de-DE")} € gesetzt.`
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: "Unerwarteter Fehler beim Upload." },
      { status: 500 }
    );
  }
}

