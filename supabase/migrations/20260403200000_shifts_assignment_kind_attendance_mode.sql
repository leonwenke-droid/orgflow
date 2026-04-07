-- Schichtplanung v2: vier Zuteilungstypen + Anwesenheitsmodus pro Schicht.

alter table public.shifts
  add column if not exists assignment_kind text not null default 'self_signup'
    constraint shifts_assignment_kind_check
    check (assignment_kind in ('self_signup', 'auto_assign', 'rotation', 'fixed'));

alter table public.shifts
  add column if not exists attendance_mode text not null default 'qr'
    constraint shifts_attendance_mode_check
    check (attendance_mode in ('qr', 'admin_only', 'none'));

comment on column public.shifts.assignment_kind is
  'self_signup: members claim slots; auto_assign: batch auto-fill; rotation: admin fair rotation; fixed: admin assigns only.';
comment on column public.shifts.attendance_mode is
  'qr: self check-in link; admin_only: manual list only; none: no attendance tracking.';

-- Backfill from legacy flags, then sync flags to match kind (single source of truth going forward).
update public.shifts s
set assignment_kind = case
  when coalesce(s.auto_assign, false) then 'auto_assign'
  when coalesce(s.claimable, true) then 'self_signup'
  else 'fixed'
end;

update public.shifts s
set
  claimable = (s.assignment_kind = 'self_signup'),
  auto_assign = (s.assignment_kind = 'auto_assign');

create or replace function public.claim_shift_slot(shift_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_org_id uuid;
  v_required int;
  v_count int;
  v_kind text;
begin
  select
    s.organization_id,
    coalesce(s.required_slots, 1),
    coalesce(s.assignment_kind, 'self_signup')
  into v_org_id, v_required, v_kind
  from public.shifts s
  where s.id = claim_shift_slot.shift_id;

  if v_org_id is null then
    raise exception 'shift_not_found' using errcode = 'P0002';
  end if;

  if v_kind is distinct from 'self_signup' then
    raise exception 'not_claimable' using errcode = 'P0001';
  end if;

  select p.id into v_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.organization_id = v_org_id
    and coalesce(p.status, 'active') <> 'disabled'
    and coalesce(p.role, '') <> 'viewer'
  limit 1;

  if v_profile_id is null then
    raise exception 'not_member' using errcode = '42501';
  end if;

  select count(*) into v_count
  from public.shift_assignments sa
  where sa.shift_id = claim_shift_slot.shift_id;

  if v_count >= greatest(v_required, 1) then
    raise exception 'no_free_slots' using errcode = 'P0001';
  end if;

  insert into public.shift_assignments (shift_id, user_id, status)
  values (claim_shift_slot.shift_id, v_profile_id, 'zugewiesen');
exception
  when unique_violation then
    raise exception 'already_assigned' using errcode = '23505';
end;
$$;
