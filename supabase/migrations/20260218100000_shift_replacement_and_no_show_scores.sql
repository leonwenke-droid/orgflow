-- 1) engagement_events: Neuer Typ 'replacement_arranged' (Ersatz besorgt → Original bekommt weniger als Schicht selbst gemacht)
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
    'task_done','shift_done','sponsoring_success','lead_weekly','task_late','shift_missed','task_missed','score_import','replacement_arranged'
  ));

-- 2) Schicht-Score-Trigger: Bei Ersatz → Original bekommt "replacement_organized" (weniger), Ersatz "shift_done". Ohne Ersatz → "shift_missed" (Abzug).
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
      values (new.user_id, 'shift_done', 1, 0, 'shift_assignment', new.id);
    elsif new.status = 'abgesagt' and (old.status is distinct from new.status) then
      if new.replacement_user_id is not null then
        -- Ersatz besorgt: Original bekommt weniger (replacement_organized), Ersatz bekommt shift_done
        insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
        values (new.user_id, 'replacement_organized', 0.5, 0, 'shift_assignment', new.id);
        insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
        values (new.replacement_user_id, 'shift_done', 1, 0, 'shift_assignment', new.id);
      else
        -- Nicht angetreten, kein Ersatz (kein Becheid) → Abzug
        insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
        values (new.user_id, 'shift_missed', 2, 2, 'shift_assignment', new.id);
      end if;
    end if;
  end if;
  return new;
end;
$$;
