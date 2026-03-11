import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

/**
 * Excel-Vorlage für Mitglieder-Import.
 * Sheet "Engagement Overview": Name (A), Score (B), leer, Komitees (D, kommagetrennt), Leitungen (E, kommagetrennt).
 */
export async function GET() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Name", "Score", "", "Komitees (kommagetrennt)", "Leitungen (kommagetrennt)"],
    ["Max Mustermann", 0, "", "Dekoration", "Dekoration"],
    ["Anna Beispiel", 10, "", "Catering, Dekoration", "Catering"]
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Engagement Overview");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Mitglieder-Vorlage.xlsx"'
    }
  });
}
