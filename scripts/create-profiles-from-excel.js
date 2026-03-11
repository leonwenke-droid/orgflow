/**
 * Legt Profile aus der Excel-Datei an (wenn profiles leer sind oder wiederhergestellt
 * werden sollen). Verwendet dieselbe Excel-Struktur wie import-engagement-from-excel.
 * Setzt auch Score (engagement_events score_import), Komitee und profile_committees.
 *
 * Vorher Migrationen ausführen: npx supabase db push
 * (damit profiles die Spalten auth_user_id und email hat)
 *
 * Aufruf: node scripts/create-profiles-from-excel.js <Pfad-zur-Excel>
 * Beispiel: node scripts/create-profiles-from-excel.js ~/Downloads/FINAL_Engagement_Abitur_2026_MIT_BEITRAG.xlsx
 */

const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");

const excelPath = process.argv[2] || path.resolve(process.cwd(), "FINAL_Engagement_Abitur_2026_MIT_BEITRAG.xlsx");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Fehler: NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in .env setzen.");
  process.exit(1);
}

const supabase = createClient(url, key);

const NAME_COL = 1;
const SCORE_COL = 2;
const KOMITEES_COL = 4;
const LEITUNGEN_COL = 5;

function parseCommitteeList(val) {
  if (val == null || val === "" || String(val).trim() === "-") return [];
  return String(val)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function readRowsFromExcel(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets["Engagement Overview"];
  if (!sheet) {
    throw new Error("Sheet 'Engagement Overview' nicht gefunden.");
  }
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const out = new Map();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[NAME_COL]) continue;
    const name = String(row[NAME_COL]).trim();
    const scoreVal = row[SCORE_COL];
    const num = typeof scoreVal === "number" ? scoreVal : parseFloat(scoreVal);
    if (Number.isNaN(num)) continue;
    const komitees = parseCommitteeList(row[KOMITEES_COL]);
    const leitungen = parseCommitteeList(row[LEITUNGEN_COL]);
    const allCommittees = [...new Set([...leitungen, ...komitees])];
    const primaryCommittee =
      leitungen.length > 0 ? leitungen[0] : komitees.length > 0 ? komitees[0] : null;
    out.set(name, {
      score: Math.round(num),
      primaryCommittee: primaryCommittee || null,
      allCommittees,
      leadsCommittee: leitungen.length > 0
    });
  }
  return out;
}

async function main() {
  console.log("Lese Excel:", excelPath);
  const nameToRow = readRowsFromExcel(excelPath);
  console.log("Anzahl Einträge in Excel:", nameToRow.size);

  const { data: existingProfiles } = await supabase.from("profiles").select("id, full_name");
  const existingNames = new Set((existingProfiles || []).map((p) => (p.full_name || "").trim()));

  const { data: committees } = await supabase.from("committees").select("id, name");
  const nameToCommitteeId = new Map((committees || []).map((c) => [c.name, c.id]));

  const committeeNamesFromExcel = new Set();
  for (const row of nameToRow.values()) {
    if (row.primaryCommittee) committeeNamesFromExcel.add(row.primaryCommittee);
    (row.allCommittees || []).forEach((n) => committeeNamesFromExcel.add(n));
  }
  for (const name of committeeNamesFromExcel) {
    if (!nameToCommitteeId.has(name)) {
      const { data: inserted, error: insErr } = await supabase
        .from("committees")
        .insert({ name })
        .select("id")
        .single();
      if (insErr) {
        console.error("Komitee anlegen:", name, insErr);
        continue;
      }
      nameToCommitteeId.set(name, inserted.id);
      console.log("Komitee angelegt:", name);
    }
  }

  let created = 0;
  for (const [fullName, row] of nameToRow) {
    if (existingNames.has(fullName)) {
      console.log("Überspringe (existiert bereits):", fullName);
      continue;
    }

    const id = randomUUID();
    const role = row.leadsCommittee ? "lead" : "member";
    const committeeId = row.primaryCommittee ? nameToCommitteeId.get(row.primaryCommittee) || null : null;

    const { error: profErr } = await supabase.from("profiles").insert({
      id,
      full_name: fullName,
      role,
      committee_id: committeeId,
      auth_user_id: null,
      email: null
    });
    if (profErr) {
      console.error("Profil anlegen:", fullName, profErr);
      continue;
    }

    const { error: evErr } = await supabase.from("engagement_events").insert({
      user_id: id,
      event_type: "score_import",
      points: row.score,
      source_id: null
    });
    if (evErr) console.error("Engagement für", fullName, evErr);

    const committeeIdsToInsert = (row.allCommittees || [])
      .map((n) => nameToCommitteeId.get(n))
      .filter(Boolean);
    if (committeeIdsToInsert.length > 0) {
      const { error: pcErr } = await supabase.from("profile_committees").insert(
        [...new Set(committeeIdsToInsert)].map((cid) => ({
          user_id: id,
          committee_id: cid
        }))
      );
      if (pcErr) console.error("profile_committees für", fullName, pcErr);
    }

    created++;
    const komiteeInfo = committeeIdsToInsert.length > 1 ? `, ${committeeIdsToInsert.length} Komitees` : "";
    console.log("Angelegt:", fullName, "(" + role + komiteeInfo + ")");
  }

  console.log("");
  console.log("Fertig. Profile angelegt:", created);
  console.log("Du kannst jetzt nur für Leads/Admins Logins vergeben (Einladung in Supabase Auth).");
  console.log("Vorher in profiles bei den Leads die Spalte email setzen (gleiche E-Mail wie beim Einladen).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
