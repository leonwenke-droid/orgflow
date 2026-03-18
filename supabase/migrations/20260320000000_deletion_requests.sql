-- Minimal DSAR/deletion request tracking (GDPR/DSGVO support)

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  reason text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);

alter table public.deletion_requests enable row level security;

alter table public.deletion_requests
  add constraint deletion_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'completed'));

create index if not exists idx_deletion_requests_org on public.deletion_requests(organization_id);
create index if not exists idx_deletion_requests_profile on public.deletion_requests(profile_id);

-- User can create and view own requests
drop policy if exists "deletion_requests_insert_own" on public.deletion_requests;
create policy "deletion_requests_insert_own"
on public.deletion_requests for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = deletion_requests.profile_id
      and p.auth_user_id = auth.uid()
      and p.organization_id = deletion_requests.organization_id
      and coalesce(p.status, 'active') <> 'disabled'
  )
);

drop policy if exists "deletion_requests_select_own_or_admin" on public.deletion_requests;
create policy "deletion_requests_select_own_or_admin"
on public.deletion_requests for select
using (
  public.is_org_admin(deletion_requests.organization_id)
  or exists (
    select 1 from public.profiles p
    where p.id = deletion_requests.profile_id
      and p.auth_user_id = auth.uid()
  )
);

-- Admins can update requests in their org
drop policy if exists "deletion_requests_update_admin" on public.deletion_requests;
create policy "deletion_requests_update_admin"
on public.deletion_requests for update
using (public.is_org_admin(deletion_requests.organization_id))
with check (public.is_org_admin(deletion_requests.organization_id));

