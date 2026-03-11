/**
 * Entfernt nur die Auth-Logins (auth.users). Alle Profile und alle anderen Daten
 * bleiben erhalten. profiles.auth_user_id wird durch ON DELETE SET NULL automatisch
 * auf null gesetzt.
 *
 * Vorher Migration ausführen: npx supabase db push
 * (Migration 20260215130000_profiles_optional_auth.sql)
 *
 * Aufruf: node scripts/remove-member-logins.js
 * Trockenlauf: node scripts/remove-member-logins.js --dry-run
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
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, role, auth_user_id")
    .not("auth_user_id", "is", null);

  if (profErr) {
    console.error("Fehler beim Laden der Profile:", profErr);
    process.exit(1);
  }
  if (!profiles?.length) {
    console.log("Keine Profile mit Login gefunden (auth_user_id ist bei allen null).");
    return;
  }

  console.log(profiles.length, "Login(s) gefunden:", profiles.map((p) => p.full_name + " (" + p.role + ")").join(", "));
  if (DRY_RUN) {
    console.log("(Dry-Run: es wird nichts gelöscht)");
    return;
  }
  console.log("Entferne nur Auth-Konten, Profile bleiben unverändert …");

  for (const p of profiles) {
    const authId = p.auth_user_id;
    try {
      const { error: authErr } = await supabase.auth.admin.deleteUser(authId);
      if (authErr) {
        console.error("Auth-Löschen für", p.full_name, ":", authErr.message);
      } else {
        console.log("Login entfernt:", p.full_name);
      }
    } catch (e) {
      console.error("Fehler bei", p.full_name, ":", e.message);
    }
  }
  console.log("Fertig. Alle Profile und Daten sind unverändert.");
  console.log("");
  console.log("Nächste Schritte:");
  console.log("  1. In profiles für jede/n Lead die Spalte email setzen (gleiche E-Mail wie beim Einladen).");
  console.log("  2. Supabase Dashboard → Auth → Users → Invite User (nur Leads/Admins)");
  console.log("  3. Beim Annehmen der Einladung wird das Profil automatisch verknüpft (per E-Mail).");
}

main();
