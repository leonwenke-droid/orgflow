-- Finance categories per organization

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_finance_categories_org_key on public.finance_categories(organization_id, key);

alter table public.finance_categories enable row level security;

drop policy if exists "finance_categories_read_org" on public.finance_categories;
create policy "finance_categories_read_org"
on public.finance_categories for select
using (
  public.is_super_admin()
  or organization_id = public.current_user_organization_id()
);

drop policy if exists "finance_categories_write_admin_finance" on public.finance_categories;
create policy "finance_categories_write_admin_finance"
on public.finance_categories for all
using (
  public.is_super_admin()
  or exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.organization_id = finance_categories.organization_id
      and p.status <> 'disabled'
      and p.role in ('admin', 'lead', 'owner', 'finance', 'super_admin')
  )
)
with check (
  public.is_super_admin()
  or exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.organization_id = finance_categories.organization_id
      and p.status <> 'disabled'
      and p.role in ('admin', 'lead', 'owner', 'finance', 'super_admin')
  )
);

