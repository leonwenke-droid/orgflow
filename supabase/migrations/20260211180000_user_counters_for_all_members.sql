-- Jedes Jahrgangsmitglied (profil) hat beide Scores: Belastung + Malus in user_counters.

-- 1) Fehlende Einträge: Alle Profile bekommen eine Zeile in user_counters (0/0 falls noch nicht vorhanden)
insert into user_counters (user_id, load_index, responsibility_malus, updated_at)
select p.id, 0, 0, now()
from profiles p
where not exists (select 1 from user_counters uc where uc.user_id = p.id)
on conflict (user_id) do nothing;

-- 2) Trigger: Neues Mitglied → sofort user_counters-Zeile anlegen
create or replace function ensure_user_counters_on_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_counters (user_id, load_index, responsibility_malus, updated_at)
  values (new.id, 0, 0, now())
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_ensure_user_counters_on_profile on profiles;
create trigger trg_ensure_user_counters_on_profile
after insert on profiles
for each row
execute function ensure_user_counters_on_profile_insert();
