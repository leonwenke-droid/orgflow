-- 0) Bei DELETE aus score_events: user_counters wieder abziehen (für Status-Nachbearbeitung).
create or replace function sync_user_counters_on_score_event_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update user_counters
  set load_index = greatest(0, load_index - coalesce(old.delta_load, 0)),
      responsibility_malus = greatest(0, responsibility_malus - coalesce(old.delta_malus, 0)),
      updated_at = now()
  where user_id = old.user_id;
  return old;
end;
$$;
drop trigger if exists trg_sync_user_counters_on_score_event_delete on score_events;
create trigger trg_sync_user_counters_on_score_event_delete
after delete on score_events for each row
execute function sync_user_counters_on_score_event_delete();

-- 1) Beim Status-Update: Alte score_events für diese Zuweisung entfernen, dann neue schreiben (für nachträgliche Änderung).
create or replace function handle_shift_score_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') then
    delete from score_events where source_type = 'shift_assignment' and source_id = new.id;
    if new.status = 'erledigt' and (old.status is distinct from new.status) then
      insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
      values (new.user_id, 'shift_done', 1, 0, 'shift_assignment', new.id);
    elsif new.status = 'abgesagt' and (old.status is distinct from new.status) then
      if new.replacement_user_id is not null then
        insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
        values (new.user_id, 'replacement_organized', 0.5, 0, 'shift_assignment', new.id);
        insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
        values (new.replacement_user_id, 'shift_done', 1, 0, 'shift_assignment', new.id);
      else
        insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
        values (new.user_id, 'shift_missed', 2, 2, 'shift_assignment', new.id);
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- 2) Engagement-Trigger: Nur bei erledigt eintragen. Bei abgesagt macht die App die Einträge (mit Ersatz-Logik).
create or replace function handle_shift_engagement()
returns trigger as $$
begin
  if (tg_op = 'UPDATE') then
    if new.status = 'erledigt' and (old.status is distinct from new.status) then
      insert into engagement_events (user_id, event_type, points, source_id)
      values (new.user_id, 'shift_done', 10, new.id);
    end if;
    -- abgesagt: keine Einträge hier, App fügt replacement_arranged/shift_done/shift_missed ein
  end if;
  return new;
end;
$$ language plpgsql;
