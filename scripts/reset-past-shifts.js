/**
 * Setzt nur die Engagement-Scores zurück, die durch vergangene Schichten
 * gutgeschrieben wurden (shift_done). Schichten und Zuweisungen bleiben erhalten.
 * Die Scores werden durch den DB-Trigger automatisch neu berechnet.
 *
 * Aufruf:
 *   node scripts/reset-past-shifts.js
 *     → shift_done-Punkte für alle Schichten mit Datum vor heute entfernen
 *
 *   node scripts/reset-past-shifts.js 2026-02-01 2026-02-14
 *     → nur shift_done-Punkte für Schichten in diesem Datumsbereich
 */

const path = require("path");
const fs = require("fs");
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Fehler: NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in .env setzen.");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const fromArg = process.argv[2];
  const toArg = process.argv[3];

  let query = supabase.from("shifts").select("id, date");
  if (fromArg && toArg) {
    query = query.gte("date", fromArg).lte("date", toArg);
    console.log("Datum-Filter:", fromArg, "bis", toArg);
  } else {
    query = query.lt("date", today);
    console.log("Shift_done-Punkte für Schichten vor heute (" + today + ") werden zurückgesetzt.");
  }

  const { data: shifts, error: shiftsErr } = await query;
  if (shiftsErr) {
    console.error("Fehler beim Laden der Schichten:", shiftsErr);
    process.exit(1);
  }
  if (!shifts?.length) {
    console.log("Keine passenden Schichten gefunden.");
    return;
  }

  const shiftIds = shifts.map((s) => s.id);
  console.log(shifts.length, "Schicht(en) gefunden:", shifts.map((s) => s.date).join(", "));

  const { data: assignments, error: assignErr } = await supabase
    .from("shift_assignments")
    .select("id")
    .in("shift_id", shiftIds);

  if (assignErr) {
    console.error("Fehler beim Laden der Zuweisungen:", assignErr);
    process.exit(1);
  }

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  if (assignmentIds.length === 0) {
    console.log("Keine Zuweisungen – nichts zu tun.");
    return;
  }

  const { error: eventsErr } = await supabase
    .from("engagement_events")
    .delete()
    .eq("event_type", "shift_done")
    .in("source_id", assignmentIds);

  if (eventsErr) {
    console.error("Fehler beim Entfernen der Engagement-Events:", eventsErr);
    process.exit(1);
  }
  console.log(assignmentIds.length, "Engagement-Einträge (shift_done) entfernt. Scores wurden vom Trigger angepasst.");
}

main();
