-- Basic audit logs for sensitive actions

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_table text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_org_created_at on public.audit_logs(organization_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_read_admin" on public.audit_logs;
create policy "audit_logs_read_admin"
on public.audit_logs for select
using (
  public.is_super_admin()
  or (organization_id = public.current_user_organization_id() and public.is_org_admin(organization_id))
);

-- Inserts only via service role or server actions that bypass RLS using security definer functions.
-- For now we keep inserts restricted to super_admin to avoid broad write exposure.
drop policy if exists "audit_logs_insert_super" on public.audit_logs;
create policy "audit_logs_insert_super"
on public.audit_logs for insert
with check (public.is_super_admin());

