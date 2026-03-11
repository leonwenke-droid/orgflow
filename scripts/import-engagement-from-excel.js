/**
 * Einmaliger Import: Engagement-Scores aus Excel in die DB übernehmen.
 * Nutzt engagement_events mit event_type 'score_import'; der Trigger aktualisiert engagement_scores.
 *
 * Aufruf: node scripts/import-engagement-from-excel.js <Pfad-zur-Excel>
 * Beispiel: node scripts/import-engagement-from-excel.js ~/Downloads/FINAL_Engagement_Abitur_2026_MIT_BEITRAG.xlsx
 */

const path = require("path");
const fs = require("fs");
for (const envFile of [".env.local", ".env"]) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    break;
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
  const sheet =
    wb.Sheets["Engagement Scores"] ||
    wb.Sheets["Engagement Overview"] ||
    (wb.SheetNames && wb.SheetNames[0] ? wb.Sheets[wb.SheetNames[0]] : null);
  if (!sheet) {
    throw new Error(
      "Kein Sheet gefunden (erwartet: 'Engagement Scores', 'Engagement Overview' oder erstes Blatt)."
    );
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

  const [{ data: profiles, error: profError }, { data: committees, error: commError }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, role"),
      supabase.from("committees").select("id, name")
    ]);
  if (profError) {
    console.error("Profile laden:", profError);
    process.exit(1);
  }
  if (commError) {
    console.error("Komitees laden:", commError);
    process.exit(1);
  }

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

  let updated = 0;
  let skipped = 0;
  const notInExcel = [];

  for (const p of profiles || []) {
    const name = (p.full_name || "").trim();
    const row = nameToRow.get(name);
    if (!row) {
      notInExcel.push(name);
      continue;
    }

    const { error: delErr } = await supabase
      .from("engagement_events")
      .delete()
      .eq("user_id", p.id);
    if (delErr) {
      console.error("Löschen engagement_events für", name, delErr);
      skipped++;
      continue;
    }

    const { error: insErr } = await supabase.from("engagement_events").insert({
      user_id: p.id,
      event_type: "score_import",
      points: row.score,
      source_id: null
    });
    if (insErr) {
      console.error("Insert score_import für", name, insErr);
      skipped++;
      continue;
    }

    const committeeId = row.primaryCommittee
      ? nameToCommitteeId.get(row.primaryCommittee) || null
      : null;
    const newRole =
      row.leadsCommittee && p.role !== "admin" ? "lead" : p.role || "member";
    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        committee_id: committeeId,
        role: newRole
      })
      .eq("id", p.id);
    if (updErr) {
      console.error("Profil-Update für", name, updErr);
    }

    const { error: delPcErr } = await supabase
      .from("profile_committees")
      .delete()
      .eq("user_id", p.id);
    if (delPcErr) {
      console.error("profile_committees löschen für", name, delPcErr);
    }
    const committeeIdsToInsert = (row.allCommittees || [])
      .map((n) => nameToCommitteeId.get(n))
      .filter(Boolean);
    if (committeeIdsToInsert.length > 0) {
      const { error: insPcErr } = await supabase.from("profile_committees").insert(
        [...new Set(committeeIdsToInsert)].map((cid) => ({
          user_id: p.id,
          committee_id: cid
        }))
      );
      if (insPcErr) {
        console.error("profile_committees einfügen für", name, insPcErr);
      }
    }

    updated++;
  }

  console.log("Aktualisiert (Score + Komitee aus Excel):", updated);
  console.log("Übersprungen (Fehler):", skipped);
  if (notInExcel.length) {
    console.log("Profile ohne Eintrag in Excel (unverändert):", notInExcel.length);
    if (notInExcel.length <= 20) console.log("  ", notInExcel.join(", "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
