-- Fair rotation: order and preview by engagement_scores (can be negative).
-- rotation_scores remains the internal bump/decay ledger (clamped >= 0) but must not
-- drive fairness when orgs expect the same ranking as the engagement leaderboard.

create or replace function public.rotation_preview(
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
  v_w_start timestamptz;
  v_w_end timestamptz;
  v_enabled boolean;
begin
  select * into v_shift
  from public.shifts
  where id = p_shift_id;

  if not found then
    return jsonb_build_object('error', 'shift_not_found');
  end if;

  if v_shift.organization_id is distinct from p_org_id then
    return jsonb_build_object('error', 'wrong_org');
  end if;

  if coalesce(v_shift.assignment_kind, 'self_signup') is distinct from 'rotation' then
    return jsonb_build_object('error', 'not_rotation_shift');
  end if;

  select coalesce(o.rotation_config, '{}'::jsonb)
  into v_cfg
  from public.organizations o
  where o.id = p_org_id;

  v_enabled := coalesce((v_cfg->>'enabled')::boolean, true);
  if v_enabled is false then
    return jsonb_build_object('error', 'rotation_disabled');
  end if;

  select count(*)::int into v_current
  from public.shift_assignments sa
  where sa.shift_id = p_shift_id;

  v_needed := greatest(coalesce(v_shift.required_slots, 1), 1) - coalesce(v_current, 0);

  select w_start, w_end into v_w_start, v_w_end
  from public.rotation_shift_window(v_shift);

  return jsonb_build_object(
    'needed', greatest(v_needed, 0),
    'shift_id', p_shift_id,
    'rows', coalesce(
      (
        with base as (
          select
            p.id as user_id,
            p.full_name,
            coalesce(es.score, 0)::numeric as score,
            rs.last_assigned_at,
            rs.last_shift_at,
            exists (
              select 1
              from public.shift_assignments sa
              where sa.shift_id = p_shift_id
                and sa.user_id = p.id
            ) as is_assigned,
            exists (
              select 1
              from public.member_unavailability u
              where u.user_id = p.id
                and u.organization_id = p_org_id
                and u.unavailable_from < v_w_end
                and u.unavailable_until > v_w_start
            ) as is_unavail
          from public.profiles p
          left join public.rotation_scores rs
            on rs.user_id = p.id and rs.organization_id = p_org_id
          left join public.engagement_scores es
            on es.user_id = p.id
          where p.organization_id = p_org_id
            and coalesce(p.status, 'active') <> 'disabled'
            and coalesce(p.role::text, '') <> 'viewer'
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
        ),
        eligible as (
          select
            user_id,
            full_name,
            score,
            last_assigned_at,
            last_shift_at,
            row_number() over (
              order by
                score asc,
                last_assigned_at asc nulls first,
                full_name asc
            ) as rn
          from base
          where not is_assigned
            and not is_unavail
        ),
        combined as (
          select
            b.user_id,
            b.full_name,
            b.score,
            b.last_assigned_at,
            b.last_shift_at,
            case
              when b.is_assigned then 'already_assigned'
              when b.is_unavail then 'unavailable'
              else null
            end as blocked,
            case
              when b.is_assigned or b.is_unavail then false
              else coalesce(e.rn <= greatest(v_needed, 0), false)
            end as will_assign
          from base b
          left join eligible e on e.user_id = b.user_id
        )
        select jsonb_agg(
          jsonb_build_object(
            'user_id', c.user_id,
            'full_name', c.full_name,
            'score', c.score,
            'last_assigned_at', c.last_assigned_at,
            'last_shift_at', c.last_shift_at,
            'will_assign', c.will_assign,
            'blocked', c.blocked
          )
          order by
            case when c.blocked is null then 0 else 1 end,
            c.score asc,
            c.last_assigned_at asc nulls first,
            c.full_name asc
        )
        from combined c
      ),
      '[]'::jsonb
    )
  );
end;
$$;

comment on function public.rotation_preview(uuid, uuid, uuid[]) is
  'Read-only: who would be assigned next; ordered by engagement score (same as leaderboard).';

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
    left join public.engagement_scores es
      on es.user_id = p.id
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
      coalesce(es.score, 0) asc,
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
  'Fair rotation: fill remaining slots with lowest engagement score; bumps rotation_scores on assignment.';
