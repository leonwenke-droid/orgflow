-- Rotation fairness scoring (orgflow_rotation_system spec): rotation_scores, member_unavailability,
-- rotation_config on organizations, rotation_assign RPC, completion trigger, daily decay helper.

-- ---------------------------------------------------------------------------
-- 1) Schema
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists rotation_config jsonb
  default '{
    "enabled": true,
    "pts_on_shift_done": 10,
    "pts_on_assignment": 15,
    "pts_cooldown_per_day": 0.5,
    "allow_swap": true,
    "notify_on_assignment": false
  }'::jsonb;

comment on column public.organizations.rotation_config is
  'Fair rotation weights: assignment bump, completion bump, daily decay, feature toggles.';

create table if not exists public.rotation_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  score numeric(10, 2) not null default 0,
  total_shifts_done int not null default 0,
  last_assigned_at timestamptz,
  last_shift_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

create index if not exists idx_rotation_scores_org_score
  on public.rotation_scores (organization_id, score asc);

comment on table public.rotation_scores is
  'Fair rotation score per profile/org; updated on rotation assignment and shift completion.';

create table if not exists public.member_unavailability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unavailable_from timestamptz not null,
  unavailable_until timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint member_unavailability_range check (unavailable_until > unavailable_from)
);

create index if not exists idx_member_unavailability_profile_org
  on public.member_unavailability (organization_id, user_id);

create index if not exists idx_member_unavailability_range
  on public.member_unavailability (organization_id, unavailable_from, unavailable_until);

comment on table public.member_unavailability is
  'Member blackout windows for rotation (overlapping shift interval = excluded).';

-- ---------------------------------------------------------------------------
-- 2) Helpers: shift window (Europe/Berlin) + config readers
-- ---------------------------------------------------------------------------

create or replace function public.rotation_shift_window(p_shift public.shifts)
returns table (w_start timestamptz, w_end timestamptz)
language plpgsql
immutable
as $$
declare
  v_start_local timestamp;
  v_end_local timestamp;
begin
  v_start_local := (p_shift.date::text || ' ' || p_shift.start_time::text)::timestamp;
  v_end_local := (p_shift.date::text || ' ' || p_shift.end_time::text)::timestamp;
  if v_end_local <= v_start_local then
    v_end_local := v_end_local + interval '1 day';
  end if;
  w_start := v_start_local at time zone 'Europe/Berlin';
  w_end := v_end_local at time zone 'Europe/Berlin';
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) rotation_assign — atomic assignment for assignment_kind = rotation
-- ---------------------------------------------------------------------------

create or replace function public.rotation_assign(
  p_shift_id uuid,
  p_org_id uuid,
  p_team_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift public.shifts%rowtype;
  v_needed int;
  v_current int;
  v_cfg jsonb;
  v_pts_assign numeric;
  v_profile uuid;
  v_assigned int := 0;
  v_ids uuid[] := array[]::uuid[];
  v_w_start timestamptz;
  v_w_end timestamptz;
  r record;
begin
  select * into v_shift
  from public.shifts
  where id = p_shift_id
  for update;

  if not found then
    raise exception 'shift_not_found' using errcode = 'P0002';
  end if;

  if v_shift.organization_id is distinct from p_org_id then
    raise exception 'wrong_org' using errcode = '42501';
  end if;

  if coalesce(v_shift.assignment_kind, 'self_signup') is distinct from 'rotation' then
    raise exception 'not_rotation_shift' using errcode = 'P0001';
  end if;

  select coalesce(o.rotation_config, '{}'::jsonb)
  into v_cfg
  from public.organizations o
  where o.id = p_org_id;

  if coalesce((v_cfg->>'enabled')::boolean, true) is false then
    raise exception 'rotation_disabled' using errcode = 'P0001';
  end if;

  v_pts_assign := coalesce((v_cfg->>'pts_on_assignment')::numeric, 15);

  select count(*)::int into v_current
  from public.shift_assignments sa
  where sa.shift_id = p_shift_id;

  v_needed := greatest(coalesce(v_shift.required_slots, 1), 1) - coalesce(v_current, 0);
  if v_needed <= 0 then
    return jsonb_build_object('assigned', 0, 'shift_id', p_shift_id, 'members', array[]::uuid[]);
  end if;

  select w_start, w_end into v_w_start, v_w_end
  from public.rotation_shift_window(v_shift);

  for r in
    select p.id
    from public.profiles p
    left join public.rotation_scores rs
      on rs.user_id = p.id and rs.organization_id = p_org_id
    where p.organization_id = p_org_id
      and coalesce(p.status, 'active') <> 'disabled'
      and coalesce(p.role::text, '') <> 'viewer'
      and not exists (
        select 1
        from public.shift_assignments sa
        where sa.shift_id = p_shift_id
          and sa.user_id = p.id
      )
      and not exists (
        select 1
        from public.member_unavailability u
        where u.user_id = p.id
          and u.organization_id = p_org_id
          and u.unavailable_from < v_w_end
          and u.unavailable_until > v_w_start
      )
      and (
        p_team_ids is null
        or coalesce(array_length(p_team_ids, 1), 0) = 0
        or (p.committee_id is not null and p.committee_id = any (p_team_ids))
        or exists (
          select 1
          from public.profile_committees pc
          where pc.user_id = p.id
            and pc.committee_id = any (p_team_ids)
        )
      )
    order by
      coalesce(rs.score, 0) asc,
      rs.last_assigned_at asc nulls first,
      p.full_name asc
    limit v_needed
  loop
    v_profile := r.id;

    insert into public.shift_assignments (shift_id, user_id, status)
    values (p_shift_id, v_profile, 'zugewiesen');

    insert into public.rotation_scores (user_id, organization_id, score, last_assigned_at, updated_at)
    values (v_profile, p_org_id, v_pts_assign, now(), now())
    on conflict (user_id, organization_id) do update set
      score = public.rotation_scores.score + v_pts_assign,
      last_assigned_at = now(),
      updated_at = now();

    v_assigned := v_assigned + 1;
    v_ids := array_append(v_ids, v_profile);
  end loop;

  return jsonb_build_object(
    'assigned', v_assigned,
    'shift_id', p_shift_id,
    'members', to_jsonb(v_ids)
  );
end;
$$;

comment on function public.rotation_assign(uuid, uuid, uuid[]) is
  'Fair rotation: fill remaining slots with lowest rotation_scores; bumps score on assignment.';

-- ---------------------------------------------------------------------------
-- 4) Completion: +pts_on_shift_done and remove pending bump (net -pts_assign + pts_done)
-- ---------------------------------------------------------------------------

create or replace function public.rotation_apply_shift_completed(
  p_profile_id uuid,
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg jsonb;
  v_assign numeric;
  v_done numeric;
begin
  select coalesce(o.rotation_config, '{}'::jsonb)
  into v_cfg
  from public.organizations o
  where o.id = p_organization_id;

  v_assign := coalesce((v_cfg->>'pts_on_assignment')::numeric, 15);
  v_done := coalesce((v_cfg->>'pts_on_shift_done')::numeric, 10);

  insert into public.rotation_scores (user_id, organization_id, score, total_shifts_done, last_shift_at, updated_at)
  values (
    p_profile_id,
    p_organization_id,
    greatest(0::numeric, -v_assign + v_done),
    1,
    now(),
    now()
  )
  on conflict (user_id, organization_id) do update set
    score = greatest(0::numeric, public.rotation_scores.score - v_assign + v_done),
    total_shifts_done = public.rotation_scores.total_shifts_done + 1,
    last_shift_at = now(),
    updated_at = now();
end;
$$;

create or replace function public.rotation_on_shift_completed_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_kind text;
  v_completed_old boolean;
  v_completed_new boolean;
begin
  if tg_op <> 'update' then
    return new;
  end if;

  v_completed_old :=
    (old.attendance_status = 'present'
     or coalesce(old.status::text, '') = 'erledigt');
  v_completed_new :=
    (new.attendance_status = 'present'
     or coalesce(new.status::text, '') = 'erledigt');

  if v_completed_new and not v_completed_old then
    select s.organization_id, coalesce(s.assignment_kind, 'self_signup')
    into v_org, v_kind
    from public.shifts s
    where s.id = new.shift_id;

    if v_kind = 'rotation' and v_org is not null then
      perform public.rotation_apply_shift_completed(new.user_id, v_org);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rotation_on_shift_completed on public.shift_assignments;
create trigger trg_rotation_on_shift_completed
after update of attendance_status, status on public.shift_assignments
for each row
execute procedure public.rotation_on_shift_completed_trigger();

-- ---------------------------------------------------------------------------
-- 5) Daily decay (call from pg_cron or external scheduler)
-- ---------------------------------------------------------------------------

create or replace function public.apply_rotation_daily_decay()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_decay numeric;
begin
  for r in
    select id, coalesce(rotation_config, '{}'::jsonb) as rotation_config
    from public.organizations
  loop
    v_decay := coalesce((r.rotation_config->>'pts_cooldown_per_day')::numeric, 0.5);
    if v_decay <= 0 then
      continue;
    end if;
    update public.rotation_scores rs
    set
      score = greatest(0::numeric, rs.score - v_decay),
      updated_at = now()
    where rs.organization_id = r.id;
  end loop;
end;
$$;

comment on function public.apply_rotation_daily_decay() is
  'Subtract pts_cooldown_per_day from every rotation score in each org (run daily via cron).';

-- ---------------------------------------------------------------------------
-- 6) RLS
-- ---------------------------------------------------------------------------

alter table public.rotation_scores enable row level security;

drop policy if exists rotation_scores_select_org on public.rotation_scores;
create policy rotation_scores_select_org
on public.rotation_scores
for select
using (
  organization_id = public.current_user_organization_id()
  and (
    user_id = public.current_profile_id()
    or public.current_profile_role() in ('admin', 'lead', 'owner', 'super_admin')
    or public.is_super_admin()
  )
);

alter table public.member_unavailability enable row level security;

drop policy if exists member_unavailability_select on public.member_unavailability;
create policy member_unavailability_select
on public.member_unavailability
for select
using (
  organization_id = public.current_user_organization_id()
  and (
    user_id = public.current_profile_id()
    or public.current_profile_role() in ('admin', 'lead', 'owner', 'super_admin')
    or public.is_super_admin()
  )
);

drop policy if exists member_unavailability_insert on public.member_unavailability;
create policy member_unavailability_insert
on public.member_unavailability
for insert
with check (
  organization_id = public.current_user_organization_id()
  and (
    user_id = public.current_profile_id()
    or public.current_profile_role() in ('admin', 'lead', 'owner', 'super_admin')
    or public.is_super_admin()
  )
);

drop policy if exists member_unavailability_update on public.member_unavailability;
create policy member_unavailability_update
on public.member_unavailability
for update
using (
  organization_id = public.current_user_organization_id()
  and (
    user_id = public.current_profile_id()
    or public.current_profile_role() in ('admin', 'lead', 'owner', 'super_admin')
    or public.is_super_admin()
  )
);

drop policy if exists member_unavailability_delete on public.member_unavailability;
create policy member_unavailability_delete
on public.member_unavailability
for delete
using (
  organization_id = public.current_user_organization_id()
  and (
    user_id = public.current_profile_id()
    or public.current_profile_role() in ('admin', 'lead', 'owner', 'super_admin')
    or public.is_super_admin()
  )
);

-- ---------------------------------------------------------------------------
-- 7) Grants (server-side / service role; not exposed to anon)
-- ---------------------------------------------------------------------------

revoke all on function public.rotation_assign(uuid, uuid, uuid[]) from public;
grant execute on function public.rotation_assign(uuid, uuid, uuid[]) to service_role;

revoke all on function public.apply_rotation_daily_decay() from public;
grant execute on function public.apply_rotation_daily_decay() to service_role;

revoke all on function public.rotation_apply_shift_completed(uuid, uuid) from public;
grant execute on function public.rotation_apply_shift_completed(uuid, uuid) to service_role;

-- Optional: schedule with pg_cron when extension exists, e.g.:
-- select cron.schedule('rotation-daily-decay', '5 3 * * *', 'select public.apply_rotation_daily_decay()');
