-- ============================================================================
-- TGG-Jahrgang: Alle eingeloggten Nutzer dieser Org als Admin setzen
-- und sicherstellen, dass alle Profile der Org zugeordnet sind.
-- Einmal im Supabase SQL-Editor ausführen → danach Admin-Board + Daten sichtbar.
-- ============================================================================

do $$
declare
  tgg_id uuid;
  updated int;
begin
  select id into tgg_id
  from public.organizations
  where slug = 'abi-2026-tgg' and is_active = true
  limit 1;

  if tgg_id is null then
    raise notice 'Org abi-2026-tgg nicht gefunden. Bitte zuerst 20260230100000_repair_tgg_singleton_data.sql ausführen.';
    return;
  end if;

  -- Alle Profile, die schon zur TGG-Org gehören und einen Login haben → Admin
  update public.profiles
  set role = 'admin'
  where organization_id = tgg_id
    and auth_user_id is not null
    and role is distinct from 'super_admin';

  get diagnostics updated = row_count;
  raise notice 'TGG: % Profil(e) auf Admin gesetzt.', updated;

  -- Profile mit Login, die noch keine Org haben → TGG zuweisen + Admin
  update public.profiles
  set organization_id = tgg_id, role = 'admin'
  where organization_id is null
    and auth_user_id is not null;

  get diagnostics updated = row_count;
  raise notice 'TGG: % Profil(e) mit Login der Org zugewiesen und als Admin gesetzt.', updated;
end $$;
