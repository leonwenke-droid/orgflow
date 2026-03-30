-- Phase A1: Task transfer approval queue + Resource status model expansion.

-----------------------------------------------------------------------
-- 1. task_transfer_requests
-----------------------------------------------------------------------
create table if not exists public.task_transfer_requests (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.tasks(id) on delete cascade,
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

comment on table public.task_transfer_requests
  is 'Approval queue for task hand-offs. Admin/lead must approve before owner changes.';

alter table public.task_transfer_requests enable row level security;

create policy "ttr_read_org_members" on public.task_transfer_requests
  for select using (
    organization_id in (
      select organization_id from public.profiles
      where id = public.current_profile_id()
    )
  );

create policy "ttr_insert_authenticated" on public.task_transfer_requests
  for insert with check (
    from_user_id = public.current_profile_id()
    or requested_by = public.current_profile_id()
  );

create policy "ttr_update_admin_lead" on public.task_transfer_requests
  for update using (
    exists (
      select 1 from public.profiles
      where id = public.current_profile_id()
        and organization_id = task_transfer_requests.organization_id
        and role in ('admin','lead','owner','super_admin')
    )
  );

create index if not exists idx_ttr_task_id on public.task_transfer_requests(task_id);
create index if not exists idx_ttr_org_pending
  on public.task_transfer_requests(organization_id)
  where status = 'pending';

-----------------------------------------------------------------------
-- 2. RPC: request_task_transfer
-----------------------------------------------------------------------
create or replace function public.request_task_transfer(
  p_task_id    uuid,
  p_to_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_org_id     uuid;
  v_request_id uuid;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  select organization_id into v_org_id
  from public.tasks
  where id = p_task_id and owner_id = v_profile_id;

  if v_org_id is null then
    raise exception 'not_owner_or_not_found' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.task_transfer_requests
    where task_id = p_task_id and status = 'pending'
  ) then
    raise exception 'transfer_already_pending' using errcode = '23505';
  end if;

  insert into public.task_transfer_requests
    (task_id, from_user_id, to_user_id, requested_by, organization_id)
  values
    (p_task_id, v_profile_id, p_to_user_id, v_profile_id, v_org_id)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.request_task_transfer(uuid, uuid) from public;
grant execute on function public.request_task_transfer(uuid, uuid) to authenticated;

-----------------------------------------------------------------------
-- 3. RPC: approve_task_transfer
-----------------------------------------------------------------------
create or replace function public.approve_task_transfer(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_req        record;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  select * into v_req
  from public.task_transfer_requests
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

  update public.task_transfer_requests
  set status = 'approved', reviewed_by = v_profile_id, reviewed_at = now()
  where id = p_request_id;

  update public.tasks
  set owner_id  = v_req.to_user_id,
      claimable = case when v_req.to_user_id is null then true else claimable end
  where id = v_req.task_id;
end;
$$;

revoke all on function public.approve_task_transfer(uuid) from public;
grant execute on function public.approve_task_transfer(uuid) to authenticated;

-----------------------------------------------------------------------
-- 4. RPC: reject_task_transfer
-----------------------------------------------------------------------
create or replace function public.reject_task_transfer(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_req        record;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  select * into v_req
  from public.task_transfer_requests
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

  update public.task_transfer_requests
  set status = 'rejected', reviewed_by = v_profile_id, reviewed_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.reject_task_transfer(uuid) from public;
grant execute on function public.reject_task_transfer(uuid) to authenticated;

-----------------------------------------------------------------------
-- 5. Resource / material_procurements status model expansion
-----------------------------------------------------------------------
alter table public.material_procurements
  add column if not exists status text not null default 'offen'
    check (status in ('offen','beschafft','geliehen')),
  add column if not exists quantity integer not null default 1,
  add column if not exists quantity_unit text,
  add column if not exists category text,
  add column if not exists responsible_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists needed_by date,
  add column if not exists source text check (source is null or source in ('gekauft','geliehen','vorhanden'));

comment on column public.material_procurements.status
  is 'Lifecycle status: offen (requested), beschafft (procured), geliehen (borrowed).';
comment on column public.material_procurements.quantity
  is 'Number of items (e.g. 20 Stück).';
comment on column public.material_procurements.quantity_unit
  is 'Unit label, e.g. Stück, Set, Karton.';
comment on column public.material_procurements.category
  is 'Free-text category, e.g. Catering, Technik, Aufbau.';
comment on column public.material_procurements.responsible_user_id
  is 'Profile responsible for procuring this resource.';

create index if not exists idx_material_status
  on public.material_procurements(status);
