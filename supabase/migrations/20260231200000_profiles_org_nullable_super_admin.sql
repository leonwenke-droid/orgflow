-- Super-Admins dürfen ohne Jahrgang (organization_id = null) existieren.
alter table public.profiles
  alter column organization_id drop not null;
