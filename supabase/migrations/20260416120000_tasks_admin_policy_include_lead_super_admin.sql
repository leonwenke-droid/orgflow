-- Kanban / PATCH /api/tasks/[id]/status: operative Teamleitung (lead) und Plattform-Super-Admins sollen Tasks/Shifts ändern dürfen.
-- Vorher: Policy nur admin, owner, teamlead (20260403010000) — Rolle "lead" konnte lesen, aber UPDATE lief 0 Zeilen + .single() → PGRST116.
-- Hier bewusst nur enum-Werte, die in jedem Projekt existieren: admin, owner, lead (kein separates "teamlead"-Label in SQL).

drop policy if exists "admin_full_access_tasks" on public.tasks;
create policy "admin_full_access_tasks" on public.tasks
  for all
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.organization_id = tasks.organization_id
        and p.status is distinct from 'disabled'
        and p.role in ('admin', 'owner', 'lead')
      limit 1
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.organization_id = tasks.organization_id
        and p.status is distinct from 'disabled'
        and p.role in ('admin', 'owner', 'lead')
      limit 1
    )
  );

drop policy if exists "admin_full_access_shifts" on public.shifts;
create policy "admin_full_access_shifts" on public.shifts
  for all
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.organization_id = shifts.organization_id
        and p.status is distinct from 'disabled'
        and p.role in ('admin', 'owner', 'lead')
      limit 1
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.organization_id = shifts.organization_id
        and p.status is distinct from 'disabled'
        and p.role in ('admin', 'owner', 'lead')
      limit 1
    )
  );
