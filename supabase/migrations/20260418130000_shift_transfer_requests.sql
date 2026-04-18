-- Shift transfer approval queue (like task_transfer_requests) for offering shifts for takeover.
-- Members can request to hand off an assignment; lead/admin/owner approves.
-- On approval, the assignment is marked swap_offered=true (so other members can claim via claim_shift_swap).

-----------------------------------------------------------------------
-- 1) shift_transfer_requests
-----------------------------------------------------------------------
create table if not exists public.shift_transfer_requests (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid not null references public.shift_assignments(id) on delete cascade,
  from_user_id    uuid not null references public.profiles(id) on delete cascade,
  to_user_id      uuid references public.profiles(id) on delete set null,
  requested_by    uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status          text not null default 'pending'
                  check (status in ('pending','approved','rejected')),
  reviewed_by     uuid references public.profiles(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);

comment on table public.shift_transfer_requests
  is 'Approval queue for shift hand-offs. Lead/admin must approve before an assignment can be offered for takeover.';

alter table public.shift_transfer_requests enable row level security;

-- Read: org members
drop policy if exists "str_read_org_members" on public.shift_transfer_requests;
create policy "str_read_org_members" on public.shift_transfer_requests
  for select using (
    organization_id in (
      select organization_id from public.profiles
      where id = public.current_profile_id()
    )
  );

-- Insert: requester must be current profile; must own the assignment (user_id == profile)
drop policy if exists "str_insert_authenticated" on public.shift_transfer_requests;
create policy "str_insert_authenticated" on public.shift_transfer_requests
  for insert with check (
    requested_by = public.current_profile_id()
    and from_user_id = public.current_profile_id()
  );

-- Update: lead/admin/owner/super_admin
drop policy if exists "str_update_admin_lead" on public.shift_transfer_requests;
create policy "str_update_admin_lead" on public.shift_transfer_requests
  for update using (
    exists (
      select 1 from public.profiles
      where id = public.current_profile_id()
        and organization_id = shift_transfer_requests.organization_id
        and role in ('admin','lead','owner','super_admin')
    )
  );

create index if not exists idx_shift_transfer_requests_assignment_id
  on public.shift_transfer_requests(assignment_id);
create index if not exists idx_shift_transfer_requests_org_pending
  on public.shift_transfer_requests(organization_id)
  where status = 'pending';

-----------------------------------------------------------------------
-- 2) RPC: request_shift_transfer
-----------------------------------------------------------------------
create or replace function public.request_shift_transfer(
  p_assignment_id uuid,
  p_to_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_org_id uuid;
  v_shift_id uuid;
  v_request_id uuid;
  v_owner uuid;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  select sa.user_id, sa.shift_id into v_owner, v_shift_id
  from public.shift_assignments sa
  where sa.id = p_assignment_id
    and sa.replacement_user_id is null;

  if v_shift_id is null then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;
  if v_owner is distinct from v_profile_id then
    raise exception 'not_owner' using errcode = '42501';
  end if;

  select s.organization_id into v_org_id
  from public.shifts s
  where s.id = v_shift_id;

  if v_org_id is null then
    raise exception 'shift_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.shift_transfer_requests
    where assignment_id = p_assignment_id and status = 'pending'
  ) then
    raise exception 'transfer_already_pending' using errcode = '23505';
  end if;

  insert into public.shift_transfer_requests
    (assignment_id, from_user_id, to_user_id, requested_by, organization_id)
  values
    (p_assignment_id, v_profile_id, p_to_user_id, v_profile_id, v_org_id)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.request_shift_transfer(uuid, uuid) from public;
grant execute on function public.request_shift_transfer(uuid, uuid) to authenticated;

-----------------------------------------------------------------------
-- 3) RPC: approve_shift_transfer
-----------------------------------------------------------------------
create or replace function public.approve_shift_transfer(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_req record;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  select * into v_req
  from public.shift_transfer_requests
  where id = p_request_id and status = 'pending';

  if v_req.id is null then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_profile_id
      and organization_id = v_req.organization_id
      and role in ('admin','lead','owner','super_admin')
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.shift_transfer_requests
  set status = 'approved', reviewed_by = v_profile_id, reviewed_at = now()
  where id = p_request_id;

  -- Offer the assignment for takeover (pool). If to_user_id is set, keep it for future extension (direct assignment).
  update public.shift_assignments
  set swap_offered = true,
      swap_offered_at = now()
  where id = v_req.assignment_id
    and user_id = v_req.from_user_id
    and replacement_user_id is null;
end;
$$;

revoke all on function public.approve_shift_transfer(uuid) from public;
grant execute on function public.approve_shift_transfer(uuid) to authenticated;

-----------------------------------------------------------------------
-- 4) RPC: reject_shift_transfer
-----------------------------------------------------------------------
create or replace function public.reject_shift_transfer(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_req record;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  select * into v_req
  from public.shift_transfer_requests
  where id = p_request_id and status = 'pending';

  if v_req.id is null then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_profile_id
      and organization_id = v_req.organization_id
      and role in ('admin','lead','owner','super_admin')
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.shift_transfer_requests
  set status = 'rejected', reviewed_by = v_profile_id, reviewed_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.reject_shift_transfer(uuid) from public;
grant execute on function public.reject_shift_transfer(uuid) to authenticated;

