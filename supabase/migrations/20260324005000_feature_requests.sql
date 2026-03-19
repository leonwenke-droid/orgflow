-- Simple feedback / feature request module per organisation

create table if not exists public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'new' check (status in ('new','planned','in_progress','done','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feature_requests_org on public.feature_requests(organization_id, created_at desc);

alter table public.feature_requests enable row level security;

-- Read: org admins/leads (and super_admin)
drop policy if exists "feature_requests_read_admin" on public.feature_requests;
create policy "feature_requests_read_admin"
on public.feature_requests for select
using (
  public.is_super_admin()
  or (public.is_org_admin(organization_id) and organization_id = public.current_user_organization_id())
);

-- Write: org admins/leads (and super_admin)
drop policy if exists "feature_requests_write_admin" on public.feature_requests;
create policy "feature_requests_write_admin"
on public.feature_requests for insert
with check (
  public.is_super_admin()
  or (public.is_org_admin(organization_id) and organization_id = public.current_user_organization_id())
);

drop policy if exists "feature_requests_update_admin" on public.feature_requests;
create policy "feature_requests_update_admin"
on public.feature_requests for update
using (
  public.is_super_admin()
  or (public.is_org_admin(organization_id) and organization_id = public.current_user_organization_id())
)
with check (
  public.is_super_admin()
  or (public.is_org_admin(organization_id) and organization_id = public.current_user_organization_id())
);

