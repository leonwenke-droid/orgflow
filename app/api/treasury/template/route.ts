import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["OrgFlow Finanzen-Vorlage"],
    [],
    ["Trage deinen Kontostand in Zelle M9 ein (oder ändere die Zelle im Upload-Formular)."],
    [],
    ["Beispiel:"],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Finanzen");

  // Ensure M9 exists (row 9, col 13)
  const addr = XLSX.utils.encode_cell({ r: 8, c: 12 });
  (ws as any)[addr] = { t: "n", v: 0 };

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="orgflow_finanzen_vorlage.xlsx"',
    },
  });
}

