/**
 * Legt einen Auth-User (Login) für ein bestehendes Profil an und verknüpft ihn.
 * Sendet eine Einladungs-E-Mail; nach dem Klick wird das Profil verknüpft.
 *
 * Aufruf: node scripts/create-auth-for-profile.js "Leon Wenke" "leon@example.com"
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

const fullName = process.argv[2] || "Leon Wenke";
const email = process.argv[3];

if (!email) {
  console.error("Verwendung: node scripts/create-auth-for-profile.js \"Vollständiger Name\" \"email@example.com\"");
  console.error("Beispiel:   node scripts/create-auth-for-profile.js \"Leon Wenke\" \"leon.wenke@schule.de\"");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, email, auth_user_id")
    .ilike("full_name", fullName.trim())
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
    console.log(profile.full_name, "hat bereits einen Login (auth_user_id gesetzt).");
    process.exit(0);
  }

  const { error: updErr } = await supabase
    .from("profiles")
    .update({ email: email.trim() })
    .eq("id", profile.id);

  if (updErr) {
    console.error("Profil (email) aktualisieren:", updErr);
    process.exit(1);
  }

  const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email.trim(), {
    data: { full_name: profile.full_name },
    redirectTo: process.env.NEXT_PUBLIC_SITE_URL || undefined
  });

  if (inviteErr) {
    console.error("Einladung senden:", inviteErr.message);
    process.exit(1);
  }

  if (inviteData?.user?.id) {
    await supabase.from("profiles").update({ auth_user_id: inviteData.user.id }).eq("id", profile.id);
  }

  console.log("Einladung an", email.trim(), "gesendet.");
  console.log(profile.full_name, "erhält eine E-Mail zum Setzen des Passworts. Nach dem Klick ist der Login mit dem Profil verknüpft.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
