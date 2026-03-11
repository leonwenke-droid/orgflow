-- Bei neuem Auth-User (z. B. Einladung): vorhandenes Profil per E-Mail verknüpfen,
-- sonst neues Profil anlegen (Rolle lead).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked int;
begin
  if new.email is not null then
    update public.profiles set auth_user_id = new.id where email = new.email and auth_user_id is null;
    get diagnostics linked = row_count;
    if linked > 0 then
      return new;
    end if;
  end if;
  insert into public.profiles (id, full_name, role, auth_user_id)
  values (
    gen_random_uuid(),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Unbenannt'),
    coalesce((new.raw_user_meta_data->>'role')::role, 'lead'),
    new.id
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
