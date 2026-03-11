-- ============================================================================
-- REPARATUR: Alle Daten und Profile dem Jahrgang TGG (abi-2026-tgg) zuweisen
-- Einmal im Supabase SQL-Editor ausführen, wenn Dashboard leer ist oder
-- Admin-Zugriff fehlt.
-- ============================================================================

do $$
declare
  tgg_id uuid;
begin
  -- 1) Org "abi-2026-tgg" sicherstellen (id merken)
  select id into tgg_id
  from public.organizations
  where slug = 'abi-2026-tgg' and is_active = true
  limit 1;

  if tgg_id is null then
    -- Slug abi-2026-tgg fehlt: bestehende Default-Org (id aaa...) auf TGG umstellen
    update public.organizations
    set
      name = 'Abitur 2026 - Teletta-Groß-Gymnasium Leer',
      slug = 'abi-2026-tgg',
      subdomain = 'tgg-2026',
      school_name = 'Teletta-Groß-Gymnasium',
      school_short = 'TGG',
      school_city = 'Leer',
      year = 2026,
      is_active = true,
      updated_at = now()
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    select id into tgg_id from public.organizations where slug = 'abi-2026-tgg' limit 1;
    if tgg_id is null then
      select id into tgg_id from public.organizations where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' limit 1;
    end if;
    if tgg_id is null then
      tgg_id := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    end if;
  end if;

  -- 2) Spalte organization_id anlegen, falls Multi-Tenancy-Migration noch nicht gelaufen ist
  alter table public.profiles
    add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
  alter table public.committees
    add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
    add column if not exists is_default boolean default false;
  alter table public.tasks
    add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
  alter table public.shifts
    add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
  alter table public.treasury_updates
    add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
  alter table public.engagement_scores
    add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

  -- 3) Alle Profile dieser Org zuweisen (damit Login → richtiges Dashboard + RLS)
  update public.profiles
  set organization_id = tgg_id
  where organization_id is distinct from tgg_id
     or organization_id is null;

  -- 4) Tasks, Shifts, Treasury, Engagement-Scores dieser Org zuweisen
  update public.tasks
  set organization_id = tgg_id
  where organization_id is distinct from tgg_id or organization_id is null;

  update public.shifts
  set organization_id = tgg_id
  where organization_id is distinct from tgg_id or organization_id is null;

  update public.treasury_updates
  set organization_id = tgg_id
  where organization_id is distinct from tgg_id or organization_id is null;

  update public.engagement_scores
  set organization_id = tgg_id
  where organization_id is distinct from tgg_id or organization_id is null;

  -- 5) Komitees (nur nicht-Template) dieser Org zuweisen (is_default oben angelegt)
  update public.committees
  set organization_id = tgg_id
  where (organization_id is distinct from tgg_id or organization_id is null)
    and (is_default is null or is_default = false);

  raise notice 'Reparatur abgeschlossen. TGG-Org-ID: %', tgg_id;
end $$;

-- ============================================================================
-- Optional: Admin/Lead für diesen Jahrgang (damit Zugriff auf Admin-Board)
-- E-Mail durch deine Login-E-Mail ersetzen, dann diese Zeilen ausführen.
-- ============================================================================
-- update public.profiles
-- set role = 'admin'
-- where auth_user_id = (select id from auth.users where email = 'deine-email@example.com' limit 1);
