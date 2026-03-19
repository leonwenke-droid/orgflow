-- Allow tasks/shifts to be claimable by members.

alter table public.tasks
  add column if not exists claimable boolean not null default false;

comment on column public.tasks.claimable is 'If true and owner_id is null, members can claim this task.';

alter table public.shifts
  add column if not exists claimable boolean not null default true;

comment on column public.shifts.claimable is 'If true, members can self-sign-up for this shift (if capacity allows).';

-- Secure task self-claim via RPC (no service role needed in app)
create or replace function public.claim_task(task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_org_id uuid;
  v_role text;
  v_claimable boolean;
  v_owner uuid;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  select p.organization_id, p.status, p.role
    into v_org_id, v_role
  from public.profiles p
  where p.id = v_profile_id
    and coalesce(p.status, 'active') <> 'disabled'
  limit 1;

  if v_org_id is null then
    raise exception 'not_member' using errcode = '42501';
  end if;

  if coalesce(v_role, '') = 'viewer' then
    raise exception 'read_only' using errcode = '42501';
  end if;

  select t.organization_id, coalesce(t.claimable, false), t.owner_id
    into v_org_id, v_claimable, v_owner
  from public.tasks t
  where t.id = claim_task.task_id;

  if v_org_id is null then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;

  if not v_claimable then
    raise exception 'not_claimable' using errcode = 'P0001';
  end if;

  if v_owner is not null then
    raise exception 'already_claimed' using errcode = '23505';
  end if;

  -- Must be member of same org
  if not exists (
    select 1 from public.profiles p
    where p.id = v_profile_id
      and p.organization_id = v_org_id
      and coalesce(p.status, 'active') <> 'disabled'
  ) then
    raise exception 'not_member' using errcode = '42501';
  end if;

  update public.tasks
  set owner_id = v_profile_id
  where id = claim_task.task_id
    and owner_id is null
    and coalesce(claimable, false) = true;

  if not found then
    raise exception 'already_claimed' using errcode = '23505';
  end if;
end;
$$;

revoke all on function public.claim_task(uuid) from public;
grant execute on function public.claim_task(uuid) to authenticated;

-- Update shift claim RPC to respect claimable/auto_assign.
create or replace function public.claim_shift_slot(shift_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_org_id uuid;
  v_required int;
  v_count int;
  v_claimable boolean;
  v_auto boolean;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  select s.organization_id, coalesce(s.required_slots, 1), coalesce(s.claimable, true), coalesce(s.auto_assign, false)
    into v_org_id, v_required, v_claimable, v_auto
  from public.shifts s
  where s.id = claim_shift_slot.shift_id;

  if v_org_id is null then
    raise exception 'shift_not_found' using errcode = 'P0002';
  end if;

  if v_auto = true or v_claimable = false then
    raise exception 'not_claimable' using errcode = 'P0001';
  end if;

  -- Must be member of org (and not disabled)
  if not exists (
    select 1 from public.profiles p
    where p.id = v_profile_id
      and p.organization_id = v_org_id
      and p.status <> 'disabled'
      and p.role <> 'viewer'
  ) then
    raise exception 'not_member' using errcode = '42501';
  end if;

  -- Capacity check (count all assignments regardless of RLS)
  select count(*) into v_count
  from public.shift_assignments sa
  where sa.shift_id = claim_shift_slot.shift_id;

  if v_count >= greatest(v_required, 1) then
    raise exception 'no_free_slots' using errcode = 'P0001';
  end if;

  insert into public.shift_assignments (shift_id, user_id, status)
  values (claim_shift_slot.shift_id, v_profile_id, 'zugewiesen');
exception
  when unique_violation then
    raise exception 'already_assigned' using errcode = '23505';
end;
$$;

