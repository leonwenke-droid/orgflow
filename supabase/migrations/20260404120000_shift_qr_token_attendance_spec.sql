-- Aligns with orgflow-schicht-attendance-cursor.md: shift QR + attendance metadata + atomic QR check-in RPC.

-- 1) shifts: QR fields (token + validity window)
alter table public.shifts
  add column if not exists qr_token text,
  add column if not exists qr_valid_from timestamptz,
  add column if not exists qr_valid_until timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'shifts' and c.conname = 'shifts_qr_token_key'
  ) then
    alter table public.shifts add constraint shifts_qr_token_key unique (qr_token);
  end if;
end $$;

create index if not exists idx_shifts_qr_token
  on public.shifts (qr_token)
  where qr_token is not null;

-- 2) shift_assignments: spec-style metadata (parallel to status / checked_in_at)
alter table public.shift_assignments
  add column if not exists check_in_method text
    constraint shift_assignments_check_in_method_check
    check (check_in_method is null or check_in_method in ('qr', 'manual')),
  add column if not exists attendance_status text not null default 'registered'
    constraint shift_assignments_attendance_status_check
    check (attendance_status in ('registered', 'present', 'absent', 'excused'));

create index if not exists idx_shift_assignments_attendance
  on public.shift_assignments (shift_id, attendance_status);

-- Backfill attendance_status from existing workflow
update public.shift_assignments sa
set attendance_status = case
  when coalesce(sa.checked_in_at::text, '') <> '' or sa.status::text = 'erledigt' then 'present'
  when sa.status::text = 'abgesagt' then 'absent'
  else 'registered'
end
where true;

-- 3) Atomic QR check-in (SECURITY DEFINER). user_id on shift_assignments = profiles.id.
create or replace function public.check_in_via_qr(
  p_qr_token text,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift public.shifts%rowtype;
  v_assignment public.shift_assignments%rowtype;
begin
  if p_qr_token is null or length(trim(p_qr_token)) = 0 then
    return jsonb_build_object('success', false, 'error', 'missing_token');
  end if;

  select * into v_shift
  from public.shifts
  where qr_token = p_qr_token
    and qr_valid_from is not null
    and qr_valid_until is not null
    and qr_valid_from <= now()
    and qr_valid_until >= now()
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'invalid_or_expired_token');
  end if;

  select * into v_assignment
  from public.shift_assignments
  where shift_id = v_shift.id
    and user_id = p_profile_id
    and coalesce(status::text, '') <> 'abgesagt'
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_registered');
  end if;

  if coalesce(v_assignment.checked_in_at::text, '') <> ''
     or v_assignment.attendance_status = 'present'
     or v_assignment.status::text = 'erledigt' then
    return jsonb_build_object('success', false, 'error', 'already_checked_in');
  end if;

  update public.shift_assignments
  set
    attendance_status = 'present',
    checked_in_at = now(),
    check_in_method = 'qr',
    status = 'erledigt'::public.shift_status
  where id = v_assignment.id;

  return jsonb_build_object(
    'success', true,
    'member_name', (select full_name from public.profiles where id = p_profile_id limit 1),
    'shift_title', v_shift.event_name,
    'checked_in_at', now()
  );
end;
$$;

revoke all on function public.check_in_via_qr(text, uuid) from public;
grant execute on function public.check_in_via_qr(text, uuid) to authenticated;
grant execute on function public.check_in_via_qr(text, uuid) to service_role;
