-- Allow self sign-up whenever the shift has free capacity, regardless of assignment_kind / Verteilungssystem.

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
begin
  select
    s.organization_id,
    coalesce(s.required_slots, 1)
  into v_org_id, v_required
  from public.shifts s
  where s.id = claim_shift_slot.shift_id;

  if v_org_id is null then
    raise exception 'shift_not_found' using errcode = 'P0002';
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
