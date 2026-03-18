-- Shift assignment check-in tracking

alter table public.shift_assignments
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid references public.profiles(id) on delete set null;

