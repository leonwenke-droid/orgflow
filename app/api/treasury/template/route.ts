import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["OrgFlow Treasury Template"],
    [],
    ["Put your treasury balance into cell M9 (or change the cell in the upload form)."],
    [],
    ["Example:"],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Treasury");

  // Ensure M9 exists (row 9, col 13)
  const addr = XLSX.utils.encode_cell({ r: 8, c: 12 });
  (ws as any)[addr] = { t: "n", v: 0 };

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="orgflow_treasury_template.xlsx"',
    },
  });
}

