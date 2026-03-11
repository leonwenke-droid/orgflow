/**
 * Legt die Schichten für die Karnevalsparty (18.02.2026, Aula) mit den 4 Zeitfenstern
 * und den zugewiesenen Personen an.
 *
 * Aufruf: node scripts/create-karnevalsparty-shifts.js
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

const DATE = "2026-02-20";
const LOCATION = "Aula";
const EVENT_BASE = "Karnevalsparty";

const SLOTS = [
  { start: "14:30", end: "15:30", names: ["Enno", "Tino", "Julian", "Alina", "Julia", "Hanno R.", "Sophia P.", "Mette"] },
  { start: "15:30", end: "16:30", names: ["Lara", "Thore", "Marit", "Danilo", "Ruben", "Femke", "Amelie", "Rieke"] },
  { start: "16:30", end: "17:30", names: ["Jan", "Erik", "Noah", "Thies", "Surena", "Mattis", "Donata", "Hanno S."] },
  { start: "17:30", end: "18:30", names: ["Jule V.", "Jara", "Anja", "Sarah", "Max", "Marie", "Lammert", "Zino"] }
];

function findProfileId(profiles, displayName) {
  const n = String(displayName).trim();
  if (!n) return null;
  const nNorm = n.replace(/\.$/, "").trim();
  const match = profiles.find((p) => {
    const full = (p.full_name || "").trim();
    if (full === n || full === nNorm) return true;
    if (full.startsWith(n + " ") || full.startsWith(nNorm + " ")) return true;
    const firstPart = full.split(/\s+/)[0] || "";
    if (firstPart === n || firstPart === nNorm) return true;
    if (nNorm.includes(" ") && full.startsWith(nNorm)) return true;
    if (n.includes(".") && full.startsWith(n.replace(".", ""))) return true;
    return false;
  });
  return match ? match.id : null;
}

async function main() {
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name");
  if (profErr) {
    console.error("Profile laden:", profErr);
    process.exit(1);
  }

  const createdShiftIds = [];

  for (const slot of SLOTS) {
    const eventName = `${EVENT_BASE} – ${slot.start}–${slot.end}`;
    const { data: shift, error: insErr } = await supabase
      .from("shifts")
      .insert({
        event_name: eventName,
        date: DATE,
        start_time: slot.start,
        end_time: slot.end,
        location: LOCATION,
        notes: null,
        required_slots: slot.names.length
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("Shift anlegen:", eventName, insErr);
      continue;
    }
    createdShiftIds.push(shift.id);
    console.log("Angelegt:", eventName);

    const assignments = [];
    for (const name of slot.names) {
      const userId = findProfileId(profiles || [], name);
      if (!userId) {
        console.warn("  Kein Profil gefunden für:", name);
        continue;
      }
      assignments.push({ shift_id: shift.id, user_id: userId, status: "zugewiesen" });
    }
    if (assignments.length) {
      const { error: assignErr } = await supabase.from("shift_assignments").insert(assignments);
      if (assignErr) {
        console.error("  Zuweisungen:", assignErr);
      } else {
        console.log("  Zugewiesen:", assignments.length, "Personen");
      }
    }
  }

  console.log("\nFertig. Schichten:", createdShiftIds.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
