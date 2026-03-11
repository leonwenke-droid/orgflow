-- Verhindert doppelte Gutschrift bei task_done (z. B. durch Doppelklick/Race).
-- Prüft vor dem Insert, ob für diese Aufgabe bereits ein task_done existiert.
create or replace function handle_task_engagement()
returns trigger as $$
declare
  base_points int := 8;
begin
  if (tg_op = 'UPDATE') then
    if new.status = 'erledigt' and (old.status is distinct from new.status) then
      -- Nur einfügen, wenn für diese Aufgabe noch kein task_done existiert (idempotent)
      if new.owner_id is not null and not exists (
        select 1 from engagement_events e
        where e.source_id = new.id and e.event_type = 'task_done' and e.user_id = new.owner_id
      ) then
        insert into engagement_events (user_id, event_type, points, source_id)
        values (new.owner_id, 'task_done', base_points, new.id);

        if new.due_at is not null and new.due_at < now() and not exists (
          select 1 from engagement_events e
          where e.source_id = new.id and e.event_type = 'task_late' and e.user_id = new.owner_id
        ) then
          insert into engagement_events (user_id, event_type, points, source_id)
          values (new.owner_id, 'task_late', -3, new.id);
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;
