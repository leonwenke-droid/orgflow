-- Verhindert FK-Fehler in Task-Triggern, wenn owner_id nicht in profiles existiert
-- (z. B. verwaiste oder historisch falsche IDs). Dann wird das Update nicht blockiert.

-- 1) engagement_events-Trigger
create or replace function handle_task_engagement()
returns trigger as $$
declare
  base_points int := 8;
begin
  if (tg_op = 'UPDATE') then
    if new.status = 'erledigt' and (old.status is distinct from new.status) then
      if new.owner_id is not null
        and exists (select 1 from profiles p where p.id = new.owner_id)
        and not exists (
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

-- 2) score_events-Trigger (gleiche Absicherung)
create or replace function handle_task_score_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') then
    if new.status = 'erledigt' and (old.status is distinct from new.status)
       and new.owner_id is not null
       and exists (select 1 from profiles p where p.id = new.owner_id) then
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
