-- Stellt user_counters und zugehörigen Trigger her, falls Migrationen in anderer Reihenfolge liefen.
-- Behebt: relation "user_counters" does not exist beim Aufgaben-Update (score_events → sync trigger).

create table if not exists user_counters (
  user_id uuid primary key references profiles(id),
  load_index numeric not null default 0,
  responsibility_malus numeric not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function sync_user_counters_from_score_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_counters (user_id, load_index, responsibility_malus, updated_at)
  values (
    new.user_id,
    coalesce(new.delta_load, 0),
    coalesce(new.delta_malus, 0),
    now()
  )
  on conflict (user_id) do update set
    load_index = user_counters.load_index + coalesce(new.delta_load, 0),
    responsibility_malus = user_counters.responsibility_malus + coalesce(new.delta_malus, 0),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_user_counters_on_score_event on score_events;
create trigger trg_sync_user_counters_on_score_event
after insert on score_events
for each row
execute function sync_user_counters_from_score_event();
