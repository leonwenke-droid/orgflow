-- 1) Trigger: Neue Auth-User bekommen 'member', nicht 'lead'
-- (Vorher wurde 'lead' als Fallback genutzt – führte zu 21 statt 10 Leads)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
begin
  if new.email is not null then
    select id into profile_id
    from public.profiles
    where email = new.email and auth_user_id is null
    limit 1;
    if profile_id is not null then
      update public.profiles set auth_user_id = new.id where id = profile_id;
      return new;
    end if;
  end if;
  insert into public.profiles (id, full_name, role, auth_user_id)
  values (
    gen_random_uuid(),
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1), 'Unbenannt'),
    'member',
    new.id
  );
  return new;
end;
$$;

-- 2) Leads bereinigen: Nur Leon, Hanna, Janko, Jenola, Kristin, Leni, Patricia, Tino, Viktor, Celina
-- Erst alle Leads auf member, dann die 10 Berechtigten auf lead
update public.profiles set role = 'member' where role = 'lead';

update public.profiles set role = 'lead'
where split_part(nullif(trim(full_name), ''), ' ', 1) in (
  'Leon', 'Hanna', 'Janko', 'Jenola', 'Kristin', 'Leni', 'Patricia', 'Tino', 'Viktor', 'Celina'
);
