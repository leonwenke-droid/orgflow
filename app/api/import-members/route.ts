import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import * as XLSX from "xlsx";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

const NAME_COL = 0;
const SCORE_COL = 1;
const KOMITEES_COL = 4;
const LEITUNGEN_COL = 5;

function parseCommitteeList(val: unknown): string[] {
  if (val == null || val === "" || String(val).trim() === "-") return [];
  return String(val)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function readRowsFromExcel(buffer: ArrayBuffer): Map<
  string,
  { score: number; primaryCommittee: string | null; allCommittees: string[]; leadsCommittee: boolean }
> {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets["Engagement Overview"] ?? wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("Kein Arbeitsblatt gefunden.");
  const data = XLSX.utils.sheet_to_json(sheet as XLSX.WorkSheet, { header: 1 }) as unknown[][];
  const out = new Map<
    string,
    { score: number; primaryCommittee: string | null; allCommittees: string[]; leadsCommittee: boolean }
  >();
  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[] | undefined;
    if (!row || row[NAME_COL] == null || String(row[NAME_COL]).trim() === "") continue;
    const name = String(row[NAME_COL]).trim();
    const scoreVal = row[SCORE_COL];
    const num =
      typeof scoreVal === "number" ? scoreVal : parseFloat(String(scoreVal ?? ""));
    const score = Number.isNaN(num) ? 0 : Math.round(num);
    const komitees = parseCommitteeList(row[KOMITEES_COL]);
    const leitungen = parseCommitteeList(row[LEITUNGEN_COL]);
    const allCommittees = [...new Set([...leitungen, ...komitees])];
    const primaryCommittee =
      leitungen.length > 0 ? leitungen[0] : komitees.length > 0 ? komitees[0] : null;
    out.set(name, {
      score,
      primaryCommittee,
      allCommittees,
      leadsCommittee: leitungen.length > 0
    });
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user }
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ message: "Nicht angemeldet." }, { status: 401 });
    }

    const formData = await req.formData();
    const orgSlug = formData.get("orgSlug")?.toString()?.trim();
    const file = formData.get("file") as File | null;
    if (!orgSlug || !file) {
      return NextResponse.json(
        { message: "orgSlug und Datei (file) sind erforderlich." },
        { status: 400 }
      );
    }

    const { data: org, error: orgErr } = await supabaseAuth
      .from("organizations")
      .select("id")
      .or(`slug.eq.${orgSlug},subdomain.eq.${orgSlug}`)
      .eq("is_active", true)
      .single();
    if (orgErr || !org) {
      return NextResponse.json({ message: "Organisation nicht gefunden." }, { status: 404 });
    }

    const { data: isAdmin } = await supabaseAuth.rpc("is_org_admin", {
      org_id: (org as { id: string }).id
    });
    if (!isAdmin) {
      return NextResponse.json(
        { message: "Keine Berechtigung für diese Organisation." },
        { status: 403 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const nameToRow = readRowsFromExcel(arrayBuffer);
    if (nameToRow.size === 0) {
      return NextResponse.json(
        { message: "Keine gültigen Zeilen in der Excel-Datei (Sheet 'Engagement Overview' oder erstes Sheet, Spalte A = Name)." },
        { status: 400 }
      );
    }

    const service = createSupabaseServiceRoleClient();
    const orgId = (org as { id: string }).id;

    const { data: existingProfiles } = await service
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", orgId);
    const existingNames = new Set(
      (existingProfiles ?? []).map((p: { full_name: string | null }) => (p.full_name ?? "").trim())
    );

    const { data: committees } = await service
      .from("committees")
      .select("id, name")
      .eq("organization_id", orgId);
    const nameToCommitteeId = new Map(
      (committees ?? []).map((c: { id: string; name: string }) => [c.name, c.id])
    );

    const committeeNamesFromExcel = new Set<string>();
    for (const row of nameToRow.values()) {
      if (row.primaryCommittee) committeeNamesFromExcel.add(row.primaryCommittee);
      row.allCommittees.forEach((n) => committeeNamesFromExcel.add(n));
    }
    for (const name of committeeNamesFromExcel) {
      if (!nameToCommitteeId.has(name)) {
        const { data: inserted, error: insErr } = await service
          .from("committees")
          .insert({ name, organization_id: orgId })
          .select("id")
          .single();
        if (!insErr && inserted) {
          nameToCommitteeId.set(name, (inserted as { id: string }).id);
        }
      }
    }

    let created = 0;
    for (const [fullName, row] of nameToRow) {
      if (existingNames.has(fullName)) continue;
      const id = randomUUID();
      const role = row.leadsCommittee ? "lead" : "member";
      const committeeId = row.primaryCommittee
        ? nameToCommitteeId.get(row.primaryCommittee) ?? null
        : null;

      const { error: profErr } = await service.from("profiles").insert({
        id,
        full_name: fullName,
        role,
        committee_id: committeeId,
        organization_id: orgId,
        auth_user_id: null,
        email: null
      });
      if (profErr) continue;

      if (row.score > 0) {
        await service.from("engagement_events").insert({
          user_id: id,
          event_type: "score_import",
          points: row.score,
          source_id: null
        });
      }

      const committeeIdsToInsert = [...new Set(
        row.allCommittees.map((n) => nameToCommitteeId.get(n)).filter(Boolean) as string[]
      )];
      if (committeeIdsToInsert.length > 0) {
        await service.from("profile_committees").insert(
          committeeIdsToInsert.map((cid) => ({ user_id: id, committee_id: cid }))
        );
      }
      created++;
    }

    return NextResponse.json({
      message: `${created} Mitglieder importiert.`,
      created
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Import fehlgeschlagen." },
      { status: 500 }
    );
  }
}
