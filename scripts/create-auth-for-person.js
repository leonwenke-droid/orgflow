/**
 * Legt einen Login für eine Person (Profil) an – sofort einloggbar mit Temp-Passwort.
 * Gibt E-Mail und Passwort aus.
 *
 * Aufruf: node scripts/create-auth-for-person.js "Celina Jütting"
 * Optional: node scripts/create-auth-for-person.js "Celina Jütting" "celina@example.com" "MeinPasswort1!"
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

const DEFAULT_PASSWORD = "AbiOrga2026!";
const DEFAULT_DOMAIN = "abi-orga.lead";

function slug(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const supabase = createClient(url, key);

async function main() {
  const fullName = process.argv[2]?.trim();
  if (!fullName) {
    console.error("Verwendung: node scripts/create-auth-for-person.js \"Vollständiger Name\" [E-Mail] [Passwort]");
    process.exit(1);
  }
  const emailArg = process.argv[3]?.trim();
  const passwordArg = process.argv[4]?.trim();

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, email, auth_user_id")
    .ilike("full_name", fullName)
    .maybeSingle();

  if (profErr) {
    console.error("Fehler beim Laden des Profils:", profErr);
    process.exit(1);
  }
  if (!profile) {
    console.error("Profil nicht gefunden:", fullName);
    process.exit(1);
  }

  if (profile.auth_user_id) {
    console.log(profile.full_name, "hat bereits einen Login.");
    console.log("E-Mail (Profil):", profile.email || "(nicht gesetzt)");
    console.log("Zum Zurücksetzen des Passworts: Supabase Dashboard → Authentication → Users.");
    process.exit(0);
  }

  const email =
    emailArg ||
    (profile.email && String(profile.email).trim() ? profile.email.trim() : null) ||
    `${slug(profile.full_name) || "user"}@${DEFAULT_DOMAIN}`;
  const password = passwordArg || DEFAULT_PASSWORD;

  const { error: emailUpdErr } = await supabase
    .from("profiles")
    .update({ email })
    .eq("id", profile.id);
  if (emailUpdErr) {
    console.error("Profil (email) setzen:", emailUpdErr);
    process.exit(1);
  }

  const { data: userData, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: profile.full_name }
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

  const { error: updErr } = await supabase
    .from("profiles")
    .update({ auth_user_id: authUserId })
    .eq("id", profile.id);
  if (updErr) {
    console.error("Profil verknüpfen:", updErr);
    process.exit(1);
  }

  console.log("Login für", profile.full_name, "angelegt.\n");
  console.log("  E-Mail:   ", email);
  console.log("  Passwort: ", password);
  console.log("\nDamit kann sich", profile.full_name, "einloggen.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
