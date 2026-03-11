-- Engagement-Punkte für Schichten mit Aufbau/Abbau: Basis 10 + 5 pro Phase.
create or replace function handle_shift_engagement()
returns trigger as $$
declare
  v_points int := 10;
  v_has_aufbau boolean;
  v_has_abbau boolean;
begin
  if (tg_op = 'UPDATE') then
    if new.status = 'erledigt' and (old.status is distinct from new.status) then
      select coalesce(s.has_aufbau, false), coalesce(s.has_abbau, false)
        into v_has_aufbau, v_has_abbau
        from shifts s
        where s.id = new.shift_id;
      v_points := 10 + (case when v_has_aufbau then 5 else 0 end) + (case when v_has_abbau then 5 else 0 end);
      insert into engagement_events (user_id, event_type, points, source_id)
      values (new.user_id, 'shift_done', v_points, new.id);
    end if;
    -- abgesagt: keine Einträge hier, App fügt replacement_arranged/shift_done/shift_missed ein
  end if;
  return new;
end;
$$ language plpgsql;
