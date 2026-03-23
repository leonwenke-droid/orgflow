-- Generic slug aliases (replaces client-side TGG slug → fixed UUID mapping).
-- Alternate URL slugs resolve to the same organization row as the primary slug.

alter table public.organizations
  add column if not exists slug_aliases text[] not null default '{}'::text[];

comment on column public.organizations.slug_aliases is
  'Alternate slugs that resolve to this organization (must not duplicate another org''s primary slug).';

-- Legacy TGG: primary slug abi-2026-tgg; short slug abi2026-tgg resolves via alias
update public.organizations
set
  slug_aliases = array['abi2026-tgg']::text[],
  updated_at = now()
where is_active = true
  and slug = 'abi-2026-tgg'
  and not ('abi2026-tgg'::text = any (slug_aliases));

create index if not exists idx_organizations_slug_aliases_gin
  on public.organizations using gin (slug_aliases);

-- Opt-in for dangerous admin bulk repair (replaces hardcoded slug allowlist in app code)
update public.organizations
set
  settings = coalesce(settings, '{}'::jsonb) || '{"legacy_bulk_sync": true}'::jsonb,
  updated_at = now()
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
