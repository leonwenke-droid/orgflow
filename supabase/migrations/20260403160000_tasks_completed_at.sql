-- Task status API PATCH sets completed_at when marking done; column was missing (PGRST204).
alter table public.tasks
  add column if not exists completed_at timestamptz;

comment on column public.tasks.completed_at is 'Timestamp when the task was last marked erledigt; null if not done or reopened.';

-- Clear when status is no longer erledigt (API only sends completed_at on transition to erledigt).
create or replace function public.tasks_sync_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status::text is distinct from 'erledigt' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_sync_completed_at on public.tasks;
create trigger trg_tasks_sync_completed_at
before update on public.tasks
for each row
execute procedure public.tasks_sync_completed_at();
