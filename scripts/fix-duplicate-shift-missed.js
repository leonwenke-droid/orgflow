/**
 * Entfernt doppelte shift_missed-Einträge: pro (user_id, source_id) nur 1 behalten.
 * Behebt -30 durch doppelte Bestrafung derselben Schicht.
 *
 * Aufruf: node scripts/fix-duplicate-shift-missed.js
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
  const { data: events, error } = await supabase
    .from("engagement_events")
    .select("id, user_id, source_id")
    .eq("event_type", "shift_missed");

  if (error) {
    console.error("Laden:", error);
    process.exit(1);
  }

  const byKey = new Map();
  for (const e of events || []) {
    const key = `${e.user_id}|${e.source_id || ""}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(e);
  }

  const toDelete = [];
  for (const [, evs] of byKey) {
    if (evs.length > 1) {
      evs.slice(1).forEach((e) => toDelete.push(e.id));
    }
  }

  if (toDelete.length === 0) {
    console.log("Keine doppelten shift_missed-Einträge gefunden.");
    return;
  }

  console.log("Entferne", toDelete.length, "doppelte Einträge:", toDelete.join(", "));
  const { error: delErr } = await supabase.from("engagement_events").delete().in("id", toDelete);
  if (delErr) {
    console.error("Löschen:", delErr);
    process.exit(1);
  }
  console.log("Fertig. engagement_scores werden durch Trigger neu berechnet.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
