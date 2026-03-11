-- shift_assignments hat user_id, kein assigned_to. Trigger anpassen, damit UPDATE nicht fehlschlägt.
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
      insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
      values (new.user_id, 'shift_missed', 2, 2, 'shift_assignment', new.id);
    elsif new.status = 'getauscht' and (old.status is distinct from new.status) then
      insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
      values (old.user_id, 'replacement_organized', 0.5, 0, 'shift_assignment', old.id);
    end if;
  end if;
  return new;
end;
$$;
