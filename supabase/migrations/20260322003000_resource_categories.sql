-- Resource categories per organization (generic resources module)

create table if not exists public.resource_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  points int not null default 0,
  examples text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_resource_categories_org_key on public.resource_categories(organization_id, key);

alter table public.resource_categories enable row level security;

drop policy if exists "resource_categories_read_org" on public.resource_categories;
create policy "resource_categories_read_org"
on public.resource_categories for select
using (
  public.is_super_admin()
  or organization_id = public.current_user_organization_id()
);

drop policy if exists "resource_categories_write_admin" on public.resource_categories;
create policy "resource_categories_write_admin"
on public.resource_categories for all
using (
  public.is_super_admin()
  or (public.is_org_admin(organization_id) and organization_id = public.current_user_organization_id())
)
with check (
  public.is_super_admin()
  or (public.is_org_admin(organization_id) and organization_id = public.current_user_organization_id())
);

