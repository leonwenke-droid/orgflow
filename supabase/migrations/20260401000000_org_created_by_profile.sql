-- Organisation creator (profile) for audit and future policy; optional on legacy rows.
alter table public.organizations
  add column if not exists created_by_profile_id uuid references public.profiles(id) on delete set null;

comment on column public.organizations.created_by_profile_id is
  'Profile that created this organisation (self-service signup). Null for orgs created before this column or via super-admin without assignment.';
