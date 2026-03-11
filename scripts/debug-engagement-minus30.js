/**
 * Untersucht: Wer hat -30 oder mehr Abzug durch shift_missed, und warum?
 * Prüft auf Doppel-Einträge (gleiche source_id mehrfach) vs. 2 echte Schichten.
 *
 * Aufruf: node scripts/debug-engagement-minus30.js
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
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Fehler: NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY setzen.");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data: events, error: evErr } = await supabase
    .from("engagement_events")
    .select("id, user_id, event_type, points, source_id, created_at")
    .eq("event_type", "shift_missed");

  if (evErr) {
    console.error("engagement_events laden:", evErr);
    process.exit(1);
  }

  const byUser = new Map();
  for (const e of events || []) {
    const uid = e.user_id;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid).push(e);
  }

  const { data: profiles } = await supabase.from("profiles").select("id, full_name");
  const names = new Map((profiles || []).map((p) => [p.id, p.full_name]));

  const { data: assignments } = await supabase
    .from("shift_assignments")
    .select("id, shift_id, user_id, status, replacement_user_id");
  const assignmentById = new Map((assignments || []).map((a) => [a.id, a]));

  const { data: shifts } = await supabase.from("shifts").select("id, event_name, date, start_time");
  const shiftById = new Map((shifts || []).map((s) => [s.id, s]));

  console.log("=== shift_missed Events (Nicht angetreten, kein Ersatz) ===\n");

  for (const [userId, userEvents] of byUser) {
    const total = userEvents.reduce((s, e) => s + (e.points || 0), 0);
    const name = names.get(userId) ?? "?";
    console.log(`--- ${name} (${userId}) ---`);
    console.log(`  Anzahl Events: ${userEvents.length}, Summe Punkte: ${total}`);

    const bySource = new Map();
    for (const e of userEvents) {
      const sid = e.source_id || "(kein source_id)";
      if (!bySource.has(sid)) bySource.set(sid, []);
      bySource.get(sid).push(e);
    }

    for (const [sourceId, evs] of bySource) {
      const a = sourceId && sourceId !== "(kein source_id)" ? assignmentById.get(sourceId) : null;
      const sh = a ? shiftById.get(a.shift_id) : null;
      const shiftInfo = sh
        ? `${sh.event_name} am ${sh.date} ${sh.start_time || ""}`
        : "unbekannte Schicht";
      if (evs.length > 1) {
        console.log(`  ⚠ DOPPELT: source_id ${sourceId} (${shiftInfo}) hat ${evs.length} Einträge!`);
      }
      console.log(`    source_id: ${sourceId}`);
      console.log(`    Schicht: ${shiftInfo}`);
      console.log(`    Event(s): ${evs.map((e) => `points=${e.points} id=${e.id}`).join(", ")}`);
    }
    console.log("");
  }

  const usersWithMinus30 = [...byUser.entries()].filter(
    ([_, evs]) => evs.reduce((s, e) => s + (e.points || 0), 0) <= -30
  );
  if (usersWithMinus30.length) {
    console.log("=== User mit mind. -30 durch shift_missed ===");
    for (const [uid, evs] of usersWithMinus30) {
      const total = evs.reduce((s, e) => s + (e.points || 0), 0);
      const sourceIds = [...new Set(evs.map((e) => e.source_id).filter(Boolean))];
      const dupes = evs.length > sourceIds.length;
      console.log(`  ${names.get(uid)}: ${total} Punkte, ${evs.length} Events, ${sourceIds.length} verschiedene Schichten`);
      if (dupes) console.log("    → Möglicher Bug: Doppelte Einträge für dieselbe Schicht!");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
