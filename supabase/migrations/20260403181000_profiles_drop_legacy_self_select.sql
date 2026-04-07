-- Stack depth (54001): legacy profiles_self_select uses
--   auth_user_id = auth.uid() OR current_profile_role() in (...)
-- current_profile_role() queries profiles again under RLS → re-entrancy with
-- other policies (e.g. tasks admin EXISTS on profiles). Split policies from
-- 20260403140000 cover self + org without that OR pattern.

drop policy if exists profiles_self_select on public.profiles;

-- Idempotent for DBs that already applied 20260403180000 without row_security:
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
