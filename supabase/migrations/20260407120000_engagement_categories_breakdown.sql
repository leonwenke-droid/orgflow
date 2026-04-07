-- engagement_events: category + FKs for breakdown; view for aggregates; trigger updates.

alter table public.engagement_events
  add column if not exists category text default 'other';

alter table public.engagement_events
  add column if not exists shift_id uuid references public.shifts(id) on delete set null;

alter table public.engagement_events
  add column if not exists task_id uuid references public.tasks(id) on delete set null;

alter table public.engagement_events
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'engagement_events_category_check'
  ) then
    alter table public.engagement_events
      add constraint engagement_events_category_check
      check (category in ('task', 'shift_auto', 'shift_rotation', 'other'));
  end if;
end $$;

update public.engagement_events e
set organization_id = p.organization_id
from public.profiles p
where e.user_id = p.id
  and e.organization_id is null;

-- Only set task_id when source_id still exists in tasks (orphan events after task delete, or bad rows).
update public.engagement_events e
set task_id = t.id
from public.tasks t
where e.event_type in ('task_done', 'task_late', 'task_missed')
  and e.source_id is not null
  and e.task_id is null
  and t.id = e.source_id;

-- Only set shift_id when assignment points at an existing shift (avoid orphan FKs).
update public.engagement_events e
set shift_id = sa.shift_id
from public.shift_assignments sa
inner join public.shifts s on s.id = sa.shift_id
where e.source_id = sa.id
  and e.event_type in ('shift_done', 'shift_missed', 'replacement_arranged')
  and e.shift_id is null;

update public.engagement_events e
set category = 'task'
where e.event_type in ('task_done', 'task_late', 'task_missed');

update public.engagement_events e
set category = case
  when coalesce(s.assignment_kind::text, '') = 'rotation' then 'shift_rotation'
  else 'shift_auto'
end
from public.shift_assignments sa
join public.shifts s on s.id = sa.shift_id
where e.source_id = sa.id
  and e.event_type in ('shift_done', 'shift_missed', 'replacement_arranged');

update public.engagement_events e
set category = case
  when coalesce(s.assignment_kind::text, '') = 'rotation' then 'shift_rotation'
  else 'shift_auto'
end
from public.shifts s
where e.shift_id = s.id
  and e.event_type in ('shift_done', 'shift_missed', 'replacement_arranged')
  and e.category = 'other';

update public.engagement_events
set category = 'other'
where category is null;

create index if not exists idx_engagement_events_user_org_created
  on public.engagement_events (user_id, organization_id, created_at desc);

create index if not exists idx_engagement_events_org_category_created
  on public.engagement_events (organization_id, category, created_at desc);

drop view if exists public.engagement_score_breakdown;

create view public.engagement_score_breakdown as
select
  e.user_id,
  e.organization_id,
  coalesce(sum(e.points), 0)::bigint as total_score,
  coalesce(sum(e.points) filter (where e.category = 'task'), 0)::bigint as task_score,
  coalesce(sum(e.points) filter (where e.category = 'shift_auto'), 0)::bigint as shift_auto_score,
  coalesce(sum(e.points) filter (where e.category = 'shift_rotation'), 0)::bigint as shift_rotation_score,
  coalesce(sum(e.points) filter (where e.category = 'other'), 0)::bigint as other_score,
  count(*) filter (where e.category = 'task')::bigint as task_count,
  count(*) filter (where e.category = 'shift_auto')::bigint as shift_auto_count,
  count(*) filter (where e.category = 'shift_rotation')::bigint as shift_rotation_count,
  count(*) filter (where e.category = 'other')::bigint as other_count
from public.engagement_events e
where e.organization_id is not null
group by e.user_id, e.organization_id;

comment on view public.engagement_score_breakdown is
  'Aggregated engagement points per profile/org by category (task, shift_auto, shift_rotation, other).';

-- Task completion trigger: include category + task_id + organization_id
create or replace function public.handle_task_engagement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_points int := 8;
  v_org uuid;
begin
  set local row_security = off;
  if (tg_op = 'UPDATE') then
    if new.status = 'erledigt' and (old.status is distinct from new.status) then
      v_org := new.organization_id;
      if new.owner_id is not null
        and exists (select 1 from public.profiles p where p.id = new.owner_id)
        and not exists (
          select 1 from public.engagement_events ev
          where ev.source_id = new.id and ev.event_type = 'task_done' and ev.user_id = new.owner_id
        ) then
        insert into public.engagement_events (
          user_id, event_type, points, source_id, category, task_id, organization_id
        )
        values (new.owner_id, 'task_done', base_points, new.id, 'task', new.id, v_org);

        if new.due_at is not null and new.due_at < now() and not exists (
          select 1 from public.engagement_events ev
          where ev.source_id = new.id and ev.event_type = 'task_late' and ev.user_id = new.owner_id
        ) then
          insert into public.engagement_events (
            user_id, event_type, points, source_id, category, task_id, organization_id
          )
          values (new.owner_id, 'task_late', -3, new.id, 'task', new.id, v_org);
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Shift completion trigger: category from assignment_kind
create or replace function public.handle_shift_engagement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points int := 10;
  v_has_aufbau boolean;
  v_has_abbau boolean;
  v_org uuid;
  v_kind text;
  v_cat text;
begin
  set local row_security = off;
  if (tg_op = 'UPDATE') then
    if new.status = 'erledigt' and (old.status is distinct from new.status) then
      select
        coalesce(s.has_aufbau, false),
        coalesce(s.has_abbau, false),
        s.organization_id,
        coalesce(s.assignment_kind::text, 'self_signup')
      into v_has_aufbau, v_has_abbau, v_org, v_kind
      from public.shifts s
      where s.id = new.shift_id;

      v_points := 10 + (case when v_has_aufbau then 5 else 0 end) + (case when v_has_abbau then 5 else 0 end);
      v_cat := case when v_kind = 'rotation' then 'shift_rotation' else 'shift_auto' end;

      insert into public.engagement_events (
        user_id, event_type, points, source_id, category, shift_id, organization_id
      )
      values (new.user_id, 'shift_done', v_points, new.id, v_cat, new.shift_id, v_org);
    end if;
  end if;
  return new;
end;
$$;
