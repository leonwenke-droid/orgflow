-- Event-Typ für einmaligen Score-Import (z. B. aus Excel) erlauben.
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
    'task_done','shift_done','sponsoring_success','lead_weekly','task_late','shift_missed','task_missed','score_import'
  ));
