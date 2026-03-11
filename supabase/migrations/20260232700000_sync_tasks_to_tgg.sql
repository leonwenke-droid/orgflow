-- ============================================================================
-- Sync: Alle Tasks (und Shifts, Treasury) der TGG-Org zuweisen
-- Führt Tasks aus der DB in der App sichtbar, wenn organization_id fehlte/falsch war.
-- ============================================================================

do $$
declare
  tgg_id uuid;
  tasks_updated int;
  shifts_updated int;
  committees_updated int;
  treasury_updated int;
begin
  -- TGG-Org per Slug oder feste ID finden
  select id into tgg_id
  from public.organizations
  where is_active = true
    and (slug = 'abi-2026-tgg' or slug = 'abi2026-tgg' or id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  limit 1;

  if tgg_id is null then
    tgg_id := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    -- Org ggf. anlegen falls nicht vorhanden
    insert into public.organizations (
      id, name, slug, subdomain, school_name, school_short, school_city, year, is_active, updated_at
    )
    values (
      tgg_id,
      'Abitur 2026 - Teletta-Groß-Gymnasium Leer',
      'abi-2026-tgg',
      'tgg-2026',
      'Teletta-Groß-Gymnasium',
      'TGG',
      'Leer',
      2026,
      true,
      now()
    )
    on conflict (id) do update set slug = 'abi-2026-tgg', updated_at = now();
  end if;

  -- Tasks: organization_id setzen (NULL oder falsch)
  update public.tasks
  set organization_id = tgg_id
  where organization_id is distinct from tgg_id or organization_id is null;
  get diagnostics tasks_updated = row_count;

  -- Shifts: ebenfalls syncen
  update public.shifts
  set organization_id = tgg_id
  where organization_id is distinct from tgg_id or organization_id is null;
  get diagnostics shifts_updated = row_count;

  -- Committees: die von Tasks referenziert werden, der TGG-Org zuweisen (falls NULL)
  update public.committees c
  set organization_id = tgg_id
  from public.tasks t
  where t.committee_id = c.id
    and (c.organization_id is distinct from tgg_id or c.organization_id is null)
    and (c.is_default is null or c.is_default = false);
  get diagnostics committees_updated = row_count;

  -- Treasury-Updates
  update public.treasury_updates
  set organization_id = tgg_id
  where organization_id is distinct from tgg_id or organization_id is null;
  get diagnostics treasury_updated = row_count;

  raise notice 'Tasks-Sync abgeschlossen. Org-ID: %. Tasks: %, Shifts: %, Committees: %, Treasury: %',
    tgg_id, tasks_updated, shifts_updated, committees_updated, treasury_updated;
end $$;
