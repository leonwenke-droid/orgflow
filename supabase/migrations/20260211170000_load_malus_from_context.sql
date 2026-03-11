-- CONTEXT.md: Belastung (load_index) und Malus (responsibility_malus) in user_counters.
-- score_events mit delta_load / delta_malus; Ziehung: w = 1/(1+load_index).

-- Tabellen sicherstellen (falls rework nicht vollständig angewendet)
create table if not exists user_counters (
  user_id uuid primary key references profiles(id),
  load_index numeric not null default 0,
  responsibility_malus numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists score_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  kind text not null,
  delta_load numeric not null default 0,
  delta_malus numeric not null default 0,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now()
);

-- 1) Trigger: Bei INSERT in score_events → user_counters aktualisieren
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

-- 2) Schicht-Statusänderungen → score_events (CONTEXT-Deltas)
-- Bestätigte Schicht: +1 Load | Ersatz organisiert: +0.5 Load | Ersatz führt aus: +1 Load | Nicht erschienen: +2 Load, +2 Malus
create or replace function handle_shift_score_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') then
    if new.status = 'erledigt' and (old.status is distinct from new.status) then
      insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
      values (coalesce(new.user_id, new.assigned_to), 'shift_done', 1, 0, 'shift_assignment', new.id);
    elsif new.status = 'abgesagt' and (old.status is distinct from new.status) then
      insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
      values (coalesce(new.user_id, new.assigned_to), 'shift_missed', 2, 2, 'shift_assignment', new.id);
    elsif new.status = 'getauscht' and (old.status is distinct from new.status) then
      insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
      values (coalesce(old.user_id, old.assigned_to), 'replacement_organized', 0.5, 0, 'shift_assignment', old.id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_shift_score_events on shift_assignments;
create trigger trg_shift_score_events
after update on shift_assignments
for each row
execute function handle_shift_score_events();

-- 3) Aufgabe erledigt (nach Verifikation) → +1 Load (CONTEXT: "Aufgaben: Score erst nach Lead-Verifikation")
-- Wir schreiben score_event wenn status -> erledigt (Verifikation erfolgt im Flow)
create or replace function handle_task_score_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') then
    if new.status = 'erledigt' and (old.status is distinct from new.status) and new.owner_id is not null then
      insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
      values (new.owner_id, 'task_verified', 1, 0, 'task', new.id);
      if new.due_at is not null and new.due_at < now() then
        insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
        values (new.owner_id, 'task_late', 0, 1, 'task', new.id);
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_task_score_events on tasks;
create trigger trg_task_score_events
after update on tasks
for each row
execute function handle_task_score_events();

-- 4) Bestehende engagement_events grob in user_counters übernehmen (load_index aus Punkten)
-- Nur User einfügen, die noch keine Zeile haben; sonst nicht überschreiben (Trigger füllt ab jetzt).
insert into user_counters (user_id, load_index, responsibility_malus, updated_at)
select user_id, greatest(0, coalesce(sum(points), 0)::numeric), 0, now()
from engagement_events
where event_type in ('task_done', 'shift_done')
group by user_id
on conflict (user_id) do nothing;
