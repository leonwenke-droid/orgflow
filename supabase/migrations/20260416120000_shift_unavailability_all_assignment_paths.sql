-- Block shift assignments when approved member_unavailability overlaps rotation_shift_window
-- (same geometry as rotation_preview / rotation_assign). Used from app (claim, auto-assign, manual).

create or replace function public.profiles_blocked_by_unavailability_for_shift(
  p_shift_id uuid,
  p_profile_ids uuid[]
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shift public.shifts%rowtype;
  v_w_start timestamptz;
  v_w_end timestamptz;
begin
  if p_profile_ids is null or coalesce(array_length(p_profile_ids, 1), 0) = 0 then
    return array[]::uuid[];
  end if;

  select * into v_shift from public.shifts where id = p_shift_id;
  if not found then
    return array[]::uuid[];
  end if;

  select w.w_start, w.w_end into v_w_start, v_w_end
  from public.rotation_shift_window(v_shift) w;

  return coalesce(
    array(
      select u.user_id
      from public.member_unavailability u
      where u.organization_id = v_shift.organization_id
        and u.user_id = any (p_profile_ids)
        and u.status = 'approved'
        and u.unavailable_from < v_w_end
        and u.unavailable_until > v_w_start
    ),
    array[]::uuid[]
  );
end;
$$;

comment on function public.profiles_blocked_by_unavailability_for_shift(uuid, uuid[]) is
  'Subset of p_profile_ids blocked by approved unavailability overlapping the shift time window.';

revoke all on function public.profiles_blocked_by_unavailability_for_shift(uuid, uuid[]) from public;
grant execute on function public.profiles_blocked_by_unavailability_for_shift(uuid, uuid[]) to authenticated;
grant execute on function public.profiles_blocked_by_unavailability_for_shift(uuid, uuid[]) to service_role;

-- Swap takeover: claimer must not be in an approved unavailability window for that shift.
create or replace function public.claim_shift_swap(assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_shift_id uuid;
  v_org_id uuid;
  v_shift public.shifts%rowtype;
  v_w_start timestamptz;
  v_w_end timestamptz;
begin
  select sa.shift_id into v_shift_id
  from public.shift_assignments sa
  where sa.id = claim_shift_swap.assignment_id
    and sa.swap_offered = true
    and sa.replacement_user_id is null;

  if v_shift_id is null then
    raise exception 'not_found_or_not_offered' using errcode = 'P0002';
  end if;

  select * into v_shift from public.shifts where id = v_shift_id;
  if not found then
    raise exception 'shift_not_found' using errcode = 'P0002';
  end if;

  v_org_id := v_shift.organization_id;

  select p.id into v_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.organization_id = v_org_id
    and coalesce(p.status, 'active') <> 'disabled'
    and coalesce(p.role, '') <> 'viewer'
  limit 1;

  if v_profile_id is null then
    raise exception 'not_member' using errcode = '42501';
  end if;

  select w.w_start, w.w_end into v_w_start, v_w_end
  from public.rotation_shift_window(v_shift) w;

  if exists (
    select 1
    from public.member_unavailability u
    where u.user_id = v_profile_id
      and u.organization_id = v_org_id
      and u.status = 'approved'
      and u.unavailable_from < v_w_end
      and u.unavailable_until > v_w_start
  ) then
    raise exception 'unavailable_for_shift' using errcode = '23514';
  end if;

  update public.shift_assignments
  set replacement_user_id = v_profile_id,
      status = 'getauscht',
      swap_offered = false
  where id = claim_shift_swap.assignment_id
    and swap_offered = true
    and replacement_user_id is null;

  if not found then
    raise exception 'already_taken' using errcode = '23505';
  end if;
end;
$$;
