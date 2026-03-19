-- Allow members to offer tasks/shifts for takeover (swap).

alter table public.shift_assignments
  add column if not exists swap_offered boolean not null default false,
  add column if not exists swap_offered_at timestamptz;

comment on column public.shift_assignments.swap_offered is 'When true, this assignment is offered for takeover by another member.';

-- Offer a task back to the pool (owner -> null, claimable true)
create or replace function public.offer_task(task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  update public.tasks
  set owner_id = null,
      claimable = true
  where id = offer_task.task_id
    and owner_id = v_profile_id;

  if not found then
    raise exception 'not_owner_or_not_found' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.offer_task(uuid) from public;
grant execute on function public.offer_task(uuid) to authenticated;

-- Offer an assignment for takeover
create or replace function public.offer_shift_swap(assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  update public.shift_assignments
  set swap_offered = true,
      swap_offered_at = now()
  where id = offer_shift_swap.assignment_id
    and user_id = v_profile_id
    and replacement_user_id is null;

  if not found then
    raise exception 'not_owner_or_not_found' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.offer_shift_swap(uuid) from public;
grant execute on function public.offer_shift_swap(uuid) to authenticated;

-- Claim a swap offer: become replacement user and mark assignment swapped
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
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  select sa.shift_id into v_shift_id
  from public.shift_assignments sa
  where sa.id = claim_shift_swap.assignment_id
    and sa.swap_offered = true
    and sa.replacement_user_id is null;

  if v_shift_id is null then
    raise exception 'not_found_or_not_offered' using errcode = 'P0002';
  end if;

  select s.organization_id into v_org_id
  from public.shifts s
  where s.id = v_shift_id;

  if v_org_id is null then
    raise exception 'shift_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_profile_id
      and p.organization_id = v_org_id
      and coalesce(p.status, 'active') <> 'disabled'
      and p.role <> 'viewer'
  ) then
    raise exception 'not_member' using errcode = '42501';
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

revoke all on function public.claim_shift_swap(uuid) from public;
grant execute on function public.claim_shift_swap(uuid) to authenticated;

