-- Multi-org: one login (auth.users) may have one profile per organisation.
-- Legacy: profiles.auth_user_id had a UNIQUE constraint → only one row per user.
-- Drop that constraint and enforce uniqueness on (auth_user_id, organization_id) instead.

do $$
declare
  c name;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
    where rel.relname = 'profiles'
      and rel.relnamespace = (select oid from pg_namespace where nspname = 'public')
      and con.contype = 'u'
      and array_length(con.conkey, 1) = 1
      and a.attname = 'auth_user_id'
  loop
    execute format('alter table public.profiles drop constraint if exists %I', c);
  end loop;
end $$;

-- At most one membership row per (login, organisation) when linked to auth.
create unique index if not exists idx_profiles_auth_user_org_unique
  on public.profiles (auth_user_id, organization_id)
  where auth_user_id is not null;

comment on index public.idx_profiles_auth_user_org_unique is
  'One profile per authenticated user per organisation (multi-org memberships).';
