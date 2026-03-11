/**
 * Behält nur die offiziellen Komitees (wie in seed_committees) und löscht alle anderen.
 * Räumt profiles.committee_id und profile_committees vorher auf.
 *
 * Aufruf: node scripts/keep-only-seed-committees.js
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
  console.error("Fehler: NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in .env setzen.");
  process.exit(1);
}

/** Nur diese Komitees bleiben (wie in supabase/migrations/20260210110000_seed_committees.sql) */
const SEED_COMMITTEE_NAMES = new Set([
  "Veranstaltungskomitee",
  "Abibuch",
  "Finanzkomitee",
  "Abiball",
  "Socialmedia",
  "Mottowoche",
  "Abistreich"
]);

const supabase = createClient(url, key);

async function main() {
  const { data: committees, error: listErr } = await supabase
    .from("committees")
    .select("id, name");
  if (listErr) {
    console.error("Komitees laden:", listErr);
    process.exit(1);
  }

  const toKeep = (committees || []).filter((c) => SEED_COMMITTEE_NAMES.has((c.name || "").trim()));
  const toRemove = (committees || []).filter((c) => !SEED_COMMITTEE_NAMES.has((c.name || "").trim()));

  if (toRemove.length === 0) {
    console.log("Es gibt nur die vorgesehenen Komitees. Nichts zu löschen.");
    return;
  }

  const idsToRemove = toRemove.map((c) => c.id);
  console.log("Entferne " + toRemove.length + " Komitee(s):");
  toRemove.forEach((c) => console.log("  -", c.name));

  await supabase.from("profiles").update({ committee_id: null }).in("committee_id", idsToRemove);
  await supabase.from("profile_committees").delete().in("committee_id", idsToRemove);
  const { error: delErr } = await supabase.from("committees").delete().in("id", idsToRemove);
  if (delErr) {
    console.error("Komitees löschen:", delErr);
    process.exit(1);
  }
  console.log("Fertig. Es bleiben nur: " + [...SEED_COMMITTEE_NAMES].join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
