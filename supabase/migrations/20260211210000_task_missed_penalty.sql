-- Aufgabe verpasst (Deadline vorbei, nicht erledigt) = -15 Punkte wie bei Schicht verpasst.
-- 1) Event-Typ 'task_missed' erlauben
do $$
declare
  c name;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'engagement_events'::regclass and contype = 'c'
  loop
    execute format('alter table engagement_events drop constraint if exists %I', c);
  end loop;
end $$;

alter table engagement_events
  add constraint engagement_events_event_type_check
  check (event_type in (
    'task_done','shift_done','sponsoring_success','lead_weekly','task_late','shift_missed','task_missed'
  ));

-- 2) Funktion: Strafen für verpasste Aufgaben einmalig anwenden (wird beim Laden von Dashboard/Admin Tasks aufgerufen)
create or replace function apply_task_missed_penalties()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into engagement_events (user_id, event_type, points, source_id)
  select t.owner_id, 'task_missed', -15, t.id
  from tasks t
  where t.owner_id is not null
    and t.status <> 'erledigt'
    and t.due_at is not null
    and t.due_at < now()
    and not exists (
      select 1 from engagement_events e
      where e.source_id = t.id and e.event_type = 'task_missed'
    );
end;
$$;

comment on function apply_task_missed_penalties() is 'Legt für alle überfälligen, nicht erledigten Aufgaben einmalig -15 Punkte (task_missed) an. Wird beim Laden von Dashboard/Admin-Aufgaben aufgerufen.';
