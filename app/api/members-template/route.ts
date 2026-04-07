import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Serves the official OrgFlow member list template (.xlsx) from /public/templates.
 * ?locale=de → German column headers; ?locale=en (default) → English.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("locale")?.trim().toLowerCase();
  const locale = raw === "de" ? "de" : "en";
  const fileBase = locale === "de" ? "orgflow-members-de.xlsx" : "orgflow-members-en.xlsx";
  const downloadName =
    locale === "de" ? "OrgFlow_Mitgliederliste.xlsx" : "OrgFlow_Members.xlsx";
  const filePath = path.join(process.cwd(), "public", "templates", fileBase);
  const buf = await readFile(filePath);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${downloadName}"`
    }
  });
}
