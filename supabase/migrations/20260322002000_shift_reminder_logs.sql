-- Prevent duplicate shift reminder emails

create table if not exists public.shift_reminder_logs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.shift_assignments(id) on delete cascade,
  sent_at timestamptz not null default now()
);

create unique index if not exists idx_shift_reminder_logs_assignment_id on public.shift_reminder_logs(assignment_id);

alter table public.shift_reminder_logs enable row level security;

-- Only service role / super admins should read/write logs (cron uses service role)
drop policy if exists "shift_reminder_logs_super_admin_read" on public.shift_reminder_logs;
create policy "shift_reminder_logs_super_admin_read"
on public.shift_reminder_logs for select
using (public.is_super_admin());

