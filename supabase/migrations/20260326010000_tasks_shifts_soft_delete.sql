-- Soft-delete support for tasks and shifts

alter table public.tasks
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.shifts
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_tasks_org_not_deleted
  on public.tasks (organization_id, due_at)
  where deleted_at is null;

create index if not exists idx_tasks_org_deleted
  on public.tasks (organization_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists idx_shifts_org_not_deleted
  on public.shifts (organization_id, date, start_time)
  where deleted_at is null;

create index if not exists idx_shifts_org_deleted
  on public.shifts (organization_id, deleted_at desc)
  where deleted_at is not null;
