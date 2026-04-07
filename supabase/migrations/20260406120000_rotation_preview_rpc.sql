-- Read-only preview: same ordering and filters as rotation_assign, no mutations.

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
            coalesce(rs.score, 0)::numeric as score,
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
  'Read-only: who would be assigned next (same rules as rotation_assign).';

revoke all on function public.rotation_preview(uuid, uuid, uuid[]) from public;
grant execute on function public.rotation_preview(uuid, uuid, uuid[]) to service_role;
