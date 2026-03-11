/**
 * Legt einen Test-Login für Leon Wenke an (festes Test-E-Mail + Passwort).
 * Keine Einladung – sofort einloggbar.
 *
 * Aufruf: node scripts/create-test-auth-leon-wenke.js
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

const TEST_EMAIL = "leon.wenke@test.de";
const TEST_PASSWORD = "TestPasswort123!";

const supabase = createClient(url, key);

async function main() {
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, auth_user_id")
    .ilike("full_name", "Leon Wenke")
    .maybeSingle();

  if (profErr) {
    console.error("Fehler beim Laden des Profils:", profErr);
    process.exit(1);
  }
  if (!profile) {
    console.error("Profil 'Leon Wenke' nicht gefunden.");
    process.exit(1);
  }

  if (profile.auth_user_id) {
    console.log("Leon Wenke hat bereits einen Login.");
    console.log("E-Mail:", TEST_EMAIL, "| Passwort: (bereits gesetzt)");
    process.exit(0);
  }

  // E-Mail zuerst setzen, damit der DB-Trigger beim createUser das bestehende Profil verknüpft (kein doppeltes Profil)
  const { error: emailErr } = await supabase
    .from("profiles")
    .update({ email: TEST_EMAIL })
    .eq("id", profile.id);

  if (emailErr) {
    console.error("Profil (email) setzen:", emailErr);
    process.exit(1);
  }

  const { data: userData, error: createErr } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Leon Wenke" }
  });

  if (createErr) {
    console.error("Auth-User anlegen:", createErr.message);
    process.exit(1);
  }

  const authUserId = userData?.user?.id;
  if (!authUserId) {
    console.error("Keine User-ID zurückgegeben.");
    process.exit(1);
  }

  // Trigger sollte bereits auth_user_id gesetzt haben; falls nicht, hier nachziehen
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ auth_user_id: authUserId })
    .eq("id", profile.id);

  if (updErr) {
    console.error("Profil verknüpfen:", updErr);
    process.exit(1);
  }

  console.log("Test-Login für Leon Wenke angelegt.");
  console.log("");
  console.log("  E-Mail:   ", TEST_EMAIL);
  console.log("  Passwort: ", TEST_PASSWORD);
  console.log("");
  console.log("Damit kann sich Leon Wenke einloggen.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
