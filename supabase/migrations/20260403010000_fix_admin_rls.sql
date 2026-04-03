-- Fix: allow org-admin roles to access tasks/shifts reliably + add index for lookups.
-- Notes:
-- - Use EXISTS with matching organization_id (safer than LIMIT 1 without org filter).
-- - Schema uses profiles.auth_user_id (not profiles.user_id).

alter table public.tasks enable row level security;
alter table public.shifts enable row level security;

drop policy if exists "admin_full_access_tasks" on public.tasks;
create policy "admin_full_access_tasks" on public.tasks
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.organization_id = tasks.organization_id
        and p.status is distinct from 'disabled'
        and p.role in ('admin', 'owner', 'teamlead')
      limit 1
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.organization_id = tasks.organization_id
        and p.status is distinct from 'disabled'
        and p.role in ('admin', 'owner', 'teamlead')
      limit 1
    )
  );

drop policy if exists "admin_full_access_shifts" on public.shifts;
create policy "admin_full_access_shifts" on public.shifts
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.organization_id = shifts.organization_id
        and p.status is distinct from 'disabled'
        and p.role in ('admin', 'owner', 'teamlead')
      limit 1
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.organization_id = shifts.organization_id
        and p.status is distinct from 'disabled'
        and p.role in ('admin', 'owner', 'teamlead')
      limit 1
    )
  );

create index if not exists idx_profiles_user_role
  on public.profiles(auth_user_id, role, organization_id);

