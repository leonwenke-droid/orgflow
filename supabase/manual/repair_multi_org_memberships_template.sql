-- =============================================================================
-- Optional: Fehlende Org-Mitgliedschaften nach „create organisation“-Bug reparieren
-- =============================================================================
-- Voraussetzungen:
--   1) Migration 20260412120000_profiles_multi_org_membership.sql ist angewendet
--      (Unique auf auth_user_id entfernt, idx_profiles_auth_user_org_unique aktiv).
--   2) Du kennst die betroffene E-Mail und die UUIDs der Organisation(en), die
--      wieder verknüpft werden sollen (z. B. aus Supabase Table Editor: organizations).
--
-- NICHT blind ausführen: erst die SELECT-Blöcke prüfen, dann ggf. INSERT anpassen.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Auth-User-ID zur E-Mail (Supabase: auth.users)
-- -----------------------------------------------------------------------------
-- select id, email, created_at
-- from auth.users
-- where lower(email) = lower('deine-adresse@example.com');

-- Ersetze für die folgenden Schritte:
--   :auth_uid   = Spalte id aus auth.users
--   :org_id     = organizations.id der fehlenden Mitgliedschaft
--   :full_name  = Anzeigename (z. B. aus letztem noch vorhandenen Profil kopieren)

-- -----------------------------------------------------------------------------
-- 2) Bestehende Profil-Zeilen dieses Logins (sollten nach Fix mehrere Zeilen sein)
-- -----------------------------------------------------------------------------
-- select p.id, p.organization_id, o.slug, o.name, p.role, p.status, p.full_name
-- from public.profiles p
-- left join public.organizations o on o.id = p.organization_id
-- where p.auth_user_id = ':auth_uid'::uuid
-- order by o.slug;

-- -----------------------------------------------------------------------------
-- 3) Organisationen auflisten (Slugs → id)
-- -----------------------------------------------------------------------------
-- select id, slug, name, is_active
-- from public.organizations
-- where slug in ('org-a', 'org-b')
-- order by slug;

-- -----------------------------------------------------------------------------
-- 4) Fehlende Mitgliedschaft anlegen (ein INSERT pro fehlender Org)
-- -----------------------------------------------------------------------------
-- Pro Org höchstens eine Zeile mit (auth_user_id, organization_id).
-- Rolle: typischerweise 'admin', wenn der User die Org angelegt hat, sonst 'member'.
-- Gültige Werte hängen vom Enum user_role in deiner DB ab (häufig: admin, member).

/*
insert into public.profiles (
  id,
  full_name,
  role,
  auth_user_id,
  email,
  organization_id,
  status,
  invite_status
)
values (
  gen_random_uuid(),
  'Vorname Nachname',
  'member',  -- ggf. 'admin'::public.user_role je nach Enum
  ':auth_uid'::uuid,
  'deine-adresse@example.com',
  ':org_id'::uuid,
  'active',
  'accepted'
);
*/

-- -----------------------------------------------------------------------------
-- 5) Wenn du nur eine „falsche“ Zeile hast (Profil zeigt auf letzte Org):
--     NICHT löschen, bis du weißt, ob Daten (tasks.owner_id etc.) darauf zeigen.
--     Besser: fehlende Zeilen wie oben INSERTen; alte Orgs bleiben über zusätzliche
--     Profil-Zeilen erreichbar.
-- =============================================================================
