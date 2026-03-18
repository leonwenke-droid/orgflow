-- Secure shift self-sign-up via RPC (no service role needed in app)

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
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  select s.organization_id, coalesce(s.required_slots, 1)
    into v_org_id, v_required
  from public.shifts s
  where s.id = claim_shift_slot.shift_id;

  if v_org_id is null then
    raise exception 'shift_not_found' using errcode = 'P0002';
  end if;

  -- Must be member of org (and not disabled)
  if not exists (
    select 1 from public.profiles p
    where p.id = v_profile_id
      and p.organization_id = v_org_id
      and p.status <> 'disabled'
  ) then
    raise exception 'not_member' using errcode = '42501';
  end if;

  -- Capacity check (count all assignments regardless of RLS)
  select count(*) into v_count
  from public.shift_assignments sa
  where sa.shift_id = claim_shift_slot.shift_id;

  if v_count >= greatest(v_required, 1) then
    raise exception 'no_free_slots' using errcode = 'P0001';
  end if;

  -- Insert own assignment (idempotent-ish: rely on unique constraint if present; otherwise catch duplicates)
  insert into public.shift_assignments (shift_id, user_id, status)
  values (claim_shift_slot.shift_id, v_profile_id, 'zugewiesen');
exception
  when unique_violation then
    raise exception 'already_assigned' using errcode = '23505';
end;
$$;

revoke all on function public.claim_shift_slot(uuid) from public;
grant execute on function public.claim_shift_slot(uuid) to authenticated;

