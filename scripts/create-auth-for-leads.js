/**
 * Legt für alle Leads (außer Leon) Logins an – sofort einloggbar mit Temp-Passwort.
 * Nutzt profile.email falls gesetzt, sonst generierte E-Mail (name@abi-orga.lead).
 *
 * Aufruf: node scripts/create-auth-for-leads.js
 * Optional: node scripts/create-auth-for-leads.js --domain=schule.de
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

const DEFAULT_PASSWORD = "AbiOrga2026!";
const DOMAIN = (() => {
  const arg = process.argv.find((a) => a.startsWith("--domain="));
  return arg ? arg.split("=")[1] : "abi-orga.lead";
})();

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

function generateEmail(fullName, profileId, usedEmails) {
  const base = slug(fullName) || "lead";
  let email = `${base}@${DOMAIN}`;
  let n = 1;
  while (usedEmails.has(email)) {
    email = `${base}-${n}@${DOMAIN}`;
    n++;
  }
  usedEmails.add(email);
  return email;
}

const supabase = createClient(url, key);

async function main() {
  const { data: leads, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, auth_user_id")
    .eq("role", "lead");

  if (error) {
    console.error("Profile laden:", error);
    process.exit(1);
  }

  const toCreate = (leads || []).filter(
    (p) =>
      !p.auth_user_id &&
      !/^Leon\b/i.test(String(p.full_name || "").trim())
  );

  if (toCreate.length === 0) {
    console.log("Keine Leads ohne Login (außer Leon) gefunden.");
    return;
  }

  console.log(`Leads ohne Login (außer Leon): ${toCreate.length}`);
  const usedEmails = new Set();

  for (const profile of toCreate) {
    const email =
      profile.email && String(profile.email).trim()
        ? profile.email.trim()
        : generateEmail(profile.full_name, profile.id, usedEmails);
    usedEmails.add(email);

    const { error: emailErr } = await supabase
      .from("profiles")
      .update({ email })
      .eq("id", profile.id);

    if (emailErr) {
      console.error(profile.full_name, "– Profil (email) setzen:", emailErr.message);
      continue;
    }

    const { data: userData, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: profile.full_name }
    });

    if (createErr) {
      console.error(profile.full_name, "– Auth anlegen:", createErr.message);
      continue;
    }

    const authUserId = userData?.user?.id;
    if (authUserId) {
      await supabase
        .from("profiles")
        .update({ auth_user_id: authUserId })
        .eq("id", profile.id);
    }

    console.log("✓", profile.full_name, "|", email, "| Passwort:", DEFAULT_PASSWORD);
  }

  console.log("");
  console.log("Fertig. Die Leads können sich mit E-Mail und Passwort einloggen.");
  console.log("(Passwort ändern nach erstem Login empfohlen.)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
