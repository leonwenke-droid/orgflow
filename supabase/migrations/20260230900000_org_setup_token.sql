-- Einrichtungs-Link: Token für berechtigte Person zum Übernehmen der Organisation als Admin
alter table public.organizations
  add column if not exists setup_token text unique,
  add column if not exists setup_token_used_at timestamptz;

create index if not exists idx_organizations_setup_token
  on public.organizations(setup_token)
  where setup_token is not null and setup_token_used_at is null;

comment on column public.organizations.setup_token is 'Einmal-Token für Einrichtungs-Link; nach Nutzung in setup_token_used_at gespeichert.';
