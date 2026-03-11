/**
 * Macht den Engagement-Score-Import rückgängig:
 * 1. Löscht alle engagement_events mit event_type 'score_import'
 *    (Trigger setzt engagement_scores danach neu)
 * 2. Entfernt durch den Import angelegte Komitees (Namen mit ":" oder "+")
 *    und räumt profile_committees / profiles.committee_id dafür auf
 *
 * Aufruf: node scripts/revert-engagement-import.js
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

const supabase = createClient(url, key);

async function main() {
  // 1) Alle score_import Events löschen (Trigger aktualisiert engagement_scores)
  const { data: deletedEvents, error: delEvErr } = await supabase
    .from("engagement_events")
    .delete()
    .eq("event_type", "score_import")
    .select("id");
  if (delEvErr) {
    console.error("engagement_events (score_import) löschen:", delEvErr);
    process.exit(1);
  }
  const count = deletedEvents?.length ?? 0;
  console.log("Gelöscht: " + count + " engagement_events (event_type = score_import).");
  console.log("Hinweis: engagement_scores werden durch Trigger neu berechnet (oft 0, da vorher alle Events pro User gelöscht wurden).");

  // 2) Komitees, die wie Excel-Artefakte aussehen (z. B. "+12: …" oder "lagern"), finden und entfernen
  const { data: committees, error: commErr } = await supabase
    .from("committees")
    .select("id, name");
  if (commErr) {
    console.error("Komitees laden:", commErr);
    return;
  }
  const toRemove = (committees || []).filter(
    (c) =>
      (c.name && (c.name.includes(":") || c.name.trim().startsWith("+"))) ||
      ["lagern", "verkaufen)"].some((s) => c.name && c.name.trim() === s)
  );
  if (toRemove.length === 0) {
    console.log("Keine durch Import angelegten Komitees zum Entfernen gefunden.");
    return;
  }
  const ids = toRemove.map((c) => c.id);
  console.log("Entferne " + toRemove.length + " Komitee(s):", toRemove.map((c) => c.name).join(", "));

  await supabase.from("profiles").update({ committee_id: null }).in("committee_id", ids);
  await supabase.from("profile_committees").delete().in("committee_id", ids);
  const { error: delCommErr } = await supabase.from("committees").delete().in("id", ids);
  if (delCommErr) {
    console.error("Komitees löschen:", delCommErr);
    return;
  }
  console.log("Komitees und Verknüpfungen bereinigt.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
