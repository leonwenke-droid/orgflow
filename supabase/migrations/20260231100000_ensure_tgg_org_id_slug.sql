-- ============================================================================
-- Multi-Tenant: Die Org für den Jahrgang TGG ist fest id = aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.
-- Dieser Slug (abi-2026-tgg) muss auf genau diese Org zeigen, damit Mitglieder und Scores sichtbar sind.
-- ============================================================================

do $$
declare
  tgg_uuid uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
begin
  -- Andere Orgs: Slug abi-2026-tgg / abi2026-tgg wegnehmen, damit nur eine Org diesen Slug hat
  update public.organizations
  set slug = slug || '-alt',
      updated_at = now()
  where (slug = 'abi-2026-tgg' or slug = 'abi2026-tgg')
    and id is distinct from tgg_uuid;

  -- Die feste Jahrgangs-Org: id = aaaa..., Slug = abi-2026-tgg (upsert)
  insert into public.organizations (
    id, name, slug, subdomain, school_name, school_short, school_city, year, is_active, updated_at
  )
  values (
    tgg_uuid,
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
  on conflict (id) do update set
    name = excluded.name,
    slug = 'abi-2026-tgg',
    subdomain = excluded.subdomain,
    school_name = excluded.school_name,
    school_short = excluded.school_short,
    school_city = excluded.school_city,
    year = excluded.year,
    is_active = true,
    updated_at = now();

  raise notice 'Org abi-2026-tgg ist id %. Alle Mitglieder mit organization_id = dieser ID gehören zu diesem Jahrgang.', tgg_uuid;
end $$;
