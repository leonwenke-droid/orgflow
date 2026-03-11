-- ============================================================================
-- MANUELL AUSFÜHREN: Tasks der TGG-Org zuweisen
-- Wenn Tasks in der DB sind, aber nicht in der App erscheinen.
-- Im Supabase Dashboard: SQL Editor → New Query → diesen Inhalt einfügen → Run
-- ============================================================================

do $$
declare
  tgg_id uuid;
  tasks_updated int;
  shifts_updated int;
  committees_updated int;
  treasury_updated int;
begin
  select id into tgg_id
  from public.organizations
  where is_active = true
    and (slug = 'abi-2026-tgg' or slug = 'abi2026-tgg' or id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  limit 1;

  if tgg_id is null then
    tgg_id := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
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

  update public.tasks
  set organization_id = tgg_id
  where organization_id is distinct from tgg_id or organization_id is null;
  get diagnostics tasks_updated = row_count;

  update public.shifts
  set organization_id = tgg_id
  where organization_id is distinct from tgg_id or organization_id is null;
  get diagnostics shifts_updated = row_count;

  update public.committees c
  set organization_id = tgg_id
  from public.tasks t
  where t.committee_id = c.id
    and (c.organization_id is distinct from tgg_id or c.organization_id is null)
    and (c.is_default is null or c.is_default = false);
  get diagnostics committees_updated = row_count;

  update public.treasury_updates
  set organization_id = tgg_id
  where organization_id is distinct from tgg_id or organization_id is null;
  get diagnostics treasury_updated = row_count;

  raise notice 'Tasks-Sync: % Tasks, % Shifts, % Committees, % Treasury-Updates der TGG-Org zugewiesen.',
    tasks_updated, shifts_updated, committees_updated, treasury_updated;
end $$;
