/**
 * Vollständiger Import aus FINAL_Engagement_Scores_Abitur_2026-4.xlsx:
 * - Engagement-Scores (Final Score) pro Person
 * - Komitees und Komitee-Leitungen (nur Zuordnung zu in der DB vorhandenen Komitees)
 *
 * Excel-Struktur (Sheet "Engagement Scores"):
 *   Spalte 0: Rang, 1: Name, 2: Final Score, 3: Jahresbeitrag, 4: Besondere Leistung,
 *   5: Komitees (kommasepariert), 6: Komitee-Leitungen (kommasepariert)
 *
 * Aufruf: node scripts/import-engagement-scores-full.js <Pfad-zur-Excel>
 * Beispiel: node scripts/import-engagement-scores-full.js ~/Downloads/FINAL_Engagement_Scores_Abitur_2026-4.xlsx
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

const excelPath = process.argv[2];
if (!excelPath) {
  console.error("Aufruf: node scripts/import-engagement-scores-full.js <Pfad-zur-Excel>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Fehler: NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in .env.local/.env setzen.");
  process.exit(1);
}

const supabase = createClient(url, key);

// Spaltenindex (0-basiert) laut Analyse der Excel
const COL_RANG = 0;
const COL_NAME = 1;
const COL_FINAL_SCORE = 2;
const COL_KOMITEES = 5;
const COL_KOMMITEE_LEITUNGEN = 6;

function parseList(val) {
  if (val == null || val === "" || String(val).trim() === "-") return [];
  return String(val)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function readExcel(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet =
    wb.Sheets["Engagement Scores"] ||
    (wb.SheetNames && wb.SheetNames[0] ? wb.Sheets[wb.SheetNames[0]] : null);
  if (!sheet) {
    throw new Error("Sheet 'Engagement Scores' nicht gefunden.");
  }
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const rows = new Map();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row[COL_NAME] == null || String(row[COL_NAME]).trim() === "") continue;
    const name = String(row[COL_NAME]).trim();
    const scoreVal = row[COL_FINAL_SCORE];
    const num = typeof scoreVal === "number" ? scoreVal : parseFloat(String(scoreVal).replace(",", "."));
    if (Number.isNaN(num)) continue;
    const komitees = parseList(row[COL_KOMITEES]);
    const leitungen = parseList(row[COL_KOMMITEE_LEITUNGEN]);
    const allNames = [...new Set([...leitungen, ...komitees])];
    const primaryName = leitungen.length > 0 ? leitungen[0] : komitees.length > 0 ? komitees[0] : null;
    rows.set(name, {
      score: Math.round(num),
      primaryCommitteeName: primaryName,
      allCommitteeNames: allNames,
      isLead: leitungen.length > 0
    });
  }
  return rows;
}

async function main() {
  console.log("Lese Excel:", excelPath);
  const excelRows = readExcel(excelPath);
  console.log("Einträge in Excel:", excelRows.size);

  const [
    { data: profiles, error: errP },
    { data: committees, error: errC }
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role"),
    supabase.from("committees").select("id, name")
  ]);
  if (errP) {
    console.error("Profile laden:", errP);
    process.exit(1);
  }
  if (errC) {
    console.error("Komitees laden:", errC);
    process.exit(1);
  }

  const committeeNameToId = new Map((committees || []).map((c) => [c.name, c.id]));

  // Zusätzliches Komitee "Fußballturnier" anlegen, falls noch nicht in DB
  if (!committeeNameToId.has("Fußballturnier")) {
    const { data: inserted, error: insErr } = await supabase
      .from("committees")
      .insert({ name: "Fußballturnier" })
      .select("id, name")
      .single();
    if (insErr) {
      console.error("Komitee Fußballturnier anlegen:", insErr);
    } else {
      committeeNameToId.set(inserted.name, inserted.id);
      console.log("Komitee angelegt: Fußballturnier");
    }
  }

  console.log("Komitees in DB (werden für Zuordnung genutzt):", [...committeeNameToId.keys()].sort().join(", "));

  let updated = 0;
  let skipped = 0;
  const notInExcel = [];
  const notFoundNames = [];

  for (const profile of profiles || []) {
    const name = (profile.full_name || "").trim();
    const row = excelRows.get(name);
    if (!row) {
      notInExcel.push(name);
      continue;
    }

    const allCommitteeIds = row.allCommitteeNames
      .map((n) => committeeNameToId.get(n))
      .filter(Boolean);
    const primaryCommitteeId = row.primaryCommitteeName
      ? committeeNameToId.get(row.primaryCommitteeName) || null
      : allCommitteeIds[0] || null;
    const newRole =
      profile.role === "admin"
        ? "admin"
        : row.isLead
          ? "lead"
          : profile.role || "member";

    // 1) Engagement-Score: alte Events löschen, einen score_import eintragen (Trigger aktualisiert engagement_scores)
    const { error: delErr } = await supabase
      .from("engagement_events")
      .delete()
      .eq("user_id", profile.id);
    if (delErr) {
      console.error("engagement_events löschen für", name, delErr);
      skipped++;
      continue;
    }
    const { error: insErr } = await supabase.from("engagement_events").insert({
      user_id: profile.id,
      event_type: "score_import",
      points: row.score,
      source_id: null
    });
    if (insErr) {
      console.error("score_import einfügen für", name, insErr);
      skipped++;
      continue;
    }

    // 2) Profil: committee_id (primäres Komitee) und Rolle
    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        committee_id: primaryCommitteeId,
        role: newRole
      })
      .eq("id", profile.id);
    if (updErr) {
      console.error("Profil-Update für", name, updErr);
    }

    // 3) profile_committees: alle Zuordnungen ersetzen (nur Komitees, die in der DB existieren)
    const { error: delPcErr } = await supabase
      .from("profile_committees")
      .delete()
      .eq("user_id", profile.id);
    if (delPcErr) {
      console.error("profile_committees löschen für", name, delPcErr);
    }
    if (allCommitteeIds.length > 0) {
      const uniqueIds = [...new Set(allCommitteeIds)];
      const { error: insPcErr } = await supabase.from("profile_committees").insert(
        uniqueIds.map((committee_id) => ({ user_id: profile.id, committee_id }))
      );
      if (insPcErr) {
        console.error("profile_committees einfügen für", name, insPcErr);
      }
    }

    updated++;
  }

  for (const [excelName] of excelRows) {
    const found = (profiles || []).some((p) => (p.full_name || "").trim() === excelName);
    if (!found) notFoundNames.push(excelName);
  }

  console.log("\n--- Ergebnis ---");
  console.log("Aktualisiert (Score + Komitees + Leitungen):", updated);
  console.log("Übersprungen (Fehler):", skipped);
  if (notInExcel.length) {
    console.log("Profile in DB ohne Eintrag in Excel (unverändert):", notInExcel.length);
    if (notInExcel.length <= 30) console.log("  ", notInExcel.join(", "));
  }
  if (notFoundNames.length) {
    console.log("Namen in Excel ohne passendes Profil:", notFoundNames.length);
    if (notFoundNames.length <= 30) console.log("  ", notFoundNames.join(", "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
