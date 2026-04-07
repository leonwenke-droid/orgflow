-- Fix: 54001 "stack depth limit exceeded" on tasks UPDATE → erledigt.
-- handle_task_engagement() ran as invoker; EXISTS/INSERT touched profiles and
-- engagement_events under RLS, amplifying policy/trigger depth. Match
-- handle_task_score_events: SECURITY DEFINER + fixed search_path.

create or replace function public.handle_task_engagement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_points int := 8;
begin
  set local row_security = off;
  if (tg_op = 'UPDATE') then
    if new.status = 'erledigt' and (old.status is distinct from new.status) then
      if new.owner_id is not null
        and exists (select 1 from public.profiles p where p.id = new.owner_id)
        and not exists (
          select 1 from public.engagement_events e
          where e.source_id = new.id and e.event_type = 'task_done' and e.user_id = new.owner_id
        ) then
        insert into public.engagement_events (user_id, event_type, points, source_id)
        values (new.owner_id, 'task_done', base_points, new.id);

        if new.due_at is not null and new.due_at < now() and not exists (
          select 1 from public.engagement_events e
          where e.source_id = new.id and e.event_type = 'task_late' and e.user_id = new.owner_id
        ) then
          insert into public.engagement_events (user_id, event_type, points, source_id)
          values (new.owner_id, 'task_late', -3, new.id);
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;
