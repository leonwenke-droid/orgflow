-- Nur admin und lead dürfen sich einloggen. Member werden gesperrt.
-- 1) Bestehende Member-Accounts sperren
update auth.users
set banned_until = '9999-12-31 23:59:59+00'::timestamptz
where id in (select id from public.profiles where role = 'member')
  and (banned_until is null or banned_until < now());

-- 2) Trigger: Bei Rollenänderung Login-Recht anpassen
create or replace function sync_auth_ban_with_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if (tg_op = 'INSERT') then
    if new.role = 'member' then
      update auth.users set banned_until = '9999-12-31 23:59:59+00'::timestamptz where id = new.id;
    else
      update auth.users set banned_until = null where id = new.id;
    end if;
  elsif (tg_op = 'UPDATE') then
    if old.role is distinct from new.role then
      if new.role = 'member' then
        update auth.users set banned_until = '9999-12-31 23:59:59+00'::timestamptz where id = new.id;
      else
        update auth.users set banned_until = null where id = new.id;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_auth_ban_with_profile_role on public.profiles;
create trigger trg_sync_auth_ban_with_profile_role
after insert or update of role on public.profiles
for each row
execute function sync_auth_ban_with_profile_role();

comment on function sync_auth_ban_with_profile_role() is 'Sperrt Auth-Login für role=member, erlaubt für admin/lead.';
