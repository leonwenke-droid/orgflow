create table if not exists public.task_reminder_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (task_id)
);

create index if not exists idx_task_reminder_logs_task on public.task_reminder_logs (task_id);

alter table public.task_reminder_logs enable row level security;
