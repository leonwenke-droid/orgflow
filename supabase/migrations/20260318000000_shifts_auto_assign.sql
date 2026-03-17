-- Allow shifts to be marked for auto-assignment (UI toggle in create form).
alter table public.shifts
  add column if not exists auto_assign boolean not null default false;

comment on column public.shifts.auto_assign is 'When true, this shift is included when running auto-assignment.';
