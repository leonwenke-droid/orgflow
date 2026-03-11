-- Profile bleiben erhalten; nur die Verknüpfung zum Login (auth) wird optional.
-- So können Auth-User gelöscht werden, ohne Profile zu löschen.

-- 1) Spalte für Login-Verknüpfung (nullable = kein Login)
alter table public.profiles
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

-- Bestehende Zeilen: auth_user_id war bisher = id (id war FK zu auth.users)
update public.profiles set auth_user_id = id where auth_user_id is null and id is not null;

comment on column public.profiles.auth_user_id is 'Verknüpfter Auth-User (Login). Null = kein Login.';

-- E-Mail für Verknüpfung bei Einladung (optional)
alter table public.profiles add column if not exists email text;
comment on column public.profiles.email is 'E-Mail; bei Einladung wird das Profil mit diesem Auth-User verknüpft.';

-- 3) FK von profiles.id zu auth.users entfernen (Name pro Instanz unterschiedlich)
do $$
declare
  c name;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'f'
      and conkey = array[(select attnum from pg_attribute where attrelid = 'public.profiles'::regclass and attname = 'id')]
  loop
    execute format('alter table public.profiles drop constraint if exists %I', c);
  end loop;
end $$;

-- 4) current_profile_role: Suche über auth_user_id
create or replace function current_profile_role()
returns role
language sql
stable
as $$
  select p.role
  from profiles p
  where p.auth_user_id = auth.uid();
$$;

-- 5) RLS profiles: Zugriff über auth_user_id
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
for select
using (auth_user_id = auth.uid() or current_profile_role() in ('admin','lead'));
