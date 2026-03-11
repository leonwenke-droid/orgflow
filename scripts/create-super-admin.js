/**
 * Legt einen Super-Admin-Account an (Auth-User + Profil mit role=super_admin, kein Jahrgang).
 *
 * Aufruf (Passwort nur über Umgebungsvariable):
 *   SUPER_ADMIN_EMAIL="leon.wenke@lyniqmedia.com" SUPER_ADMIN_PASSWORD="dein-passwort" node scripts/create-super-admin.js
 *
 * .env wird automatisch geladen (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 * Migration 20260231200000 (organization_id nullable) muss ausgeführt sein.
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
const email = process.env.SUPER_ADMIN_EMAIL || process.argv[2];
const password = process.env.SUPER_ADMIN_PASSWORD || process.argv[3];
const fullNameArg = process.env.SUPER_ADMIN_FULL_NAME || process.argv[4];

if (!url || !key) {
  console.error("Fehler: NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in .env setzen.");
  process.exit(1);
}
if (!email) {
  console.error("SUPER_ADMIN_EMAIL setzen oder als Argument angeben.");
  process.exit(1);
}
if (!password) {
  console.error("SUPER_ADMIN_PASSWORD setzen (nicht im Code eintragen). Beispiel: SUPER_ADMIN_PASSWORD=xxx node scripts/create-super-admin.js");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email && u.email.toLowerCase() === email.toLowerCase());
  if (found) {
    console.log("Auth-User existiert bereits:", email);
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, organization_id")
      .eq("auth_user_id", found.id)
      .maybeSingle();
    if (profile) {
      const updates = { role: "super_admin", organization_id: null };
      if (fullNameArg && fullNameArg.trim()) updates.full_name = fullNameArg.trim();
      const { error: upErr } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profile.id);
      if (upErr) {
        console.error("Profil auf super_admin setzen:", upErr.message);
        process.exit(1);
      }
      console.log("Profil auf role=super_admin und organization_id=null gesetzt.");
    } else {
      const { randomUUID } = require("crypto");
      const fullName = fullNameArg && fullNameArg.trim() ? fullNameArg.trim() : email.split("@")[0].replace(/[._]/g, " ") || "Super Admin";
      const { error: insErr } = await supabase.from("profiles").insert({
        id: randomUUID(),
        full_name: fullName,
        email: email.trim(),
        role: "super_admin",
        auth_user_id: found.id,
        organization_id: null
      });
      if (insErr) {
        console.error("Profil anlegen:", insErr.message);
        process.exit(1);
      }
      console.log("Profil angelegt: role=super_admin, kein Jahrgang.");
    }
    return;
  }

  const fullName = fullNameArg && fullNameArg.trim() ? fullNameArg.trim() : email.split("@")[0].replace(/[._]/g, " ") || "Super Admin";
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });

  if (authErr) {
    console.error("Auth-User anlegen:", authErr.message);
    process.exit(1);
  }

  const userId = authData?.user?.id;
  if (!userId) {
    console.error("Keine User-ID von Supabase erhalten.");
    process.exit(1);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (profile) {
    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        role: "super_admin",
        organization_id: null,
        full_name: fullName,
        email: email.trim()
      })
      .eq("id", profile.id);
    if (upErr) {
      console.error("Profil aktualisieren:", upErr.message);
      process.exit(1);
    }
    console.log("Super-Admin angelegt:", email, "(Profil auf super_admin gesetzt, kein Jahrgang)");
    return;
  }

  const { randomUUID } = require("crypto");
  const { error: insErr } = await supabase.from("profiles").insert({
    id: randomUUID(),
    full_name: fullName,
    email: email.trim(),
    role: "super_admin",
    auth_user_id: userId,
    organization_id: null
  });

  if (insErr) {
    console.error("Profil anlegen:", insErr.message);
    process.exit(1);
  }
  console.log("Super-Admin angelegt:", email, "(kein Jahrgang)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
