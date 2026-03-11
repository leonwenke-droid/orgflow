/**
 * Setzt das Datum aller Karnevalsparty-Schichten auf 20.02.2026 (Freitag).
 * Aufruf: node scripts/update-karnevalsparty-date.js
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
  const { data: shifts, error: listErr } = await supabase
    .from("shifts")
    .select("id, event_name, date")
    .like("event_name", "Karnevalsparty%");
  if (listErr) {
    console.error("Schichten laden:", listErr);
    process.exit(1);
  }
  if (!shifts?.length) {
    console.log("Keine Karnevalsparty-Schichten gefunden.");
    return;
  }
  const { error: updErr } = await supabase
    .from("shifts")
    .update({ date: "2026-02-20" })
    .like("event_name", "Karnevalsparty%");
  if (updErr) {
    console.error("Datum aktualisieren:", updErr);
    process.exit(1);
  }
  console.log("Datum auf 20.02.2026 (Freitag) gesetzt für", shifts.length, "Schicht(en).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
