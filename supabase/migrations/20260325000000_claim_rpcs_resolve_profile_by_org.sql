-- Mehrere profiles pro auth_user_id (verschiedene Orgs): current_profile_id() liefert
-- willkürlich eine Zeile (limit 1) → claim_shift_slot / claim_task schlagen mit not_member fehl.
-- Lösung: Profil immer über auth.uid() + organization_id der Schicht/Aufgabe auflösen.

create or replace function public.claim_task(task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_org_id uuid;
  v_role text;
  v_claimable boolean;
  v_owner uuid;
begin
  select t.organization_id, coalesce(t.claimable, false), t.owner_id
    into v_org_id, v_claimable, v_owner
  from public.tasks t
  where t.id = claim_task.task_id;

  if v_org_id is null then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;

  if not v_claimable then
    raise exception 'not_claimable' using errcode = 'P0001';
  end if;

  if v_owner is not null then
    raise exception 'already_claimed' using errcode = '23505';
  end if;

  select p.id, p.role into v_profile_id, v_role
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.organization_id = v_org_id
    and coalesce(p.status, 'active') <> 'disabled'
  limit 1;

  if v_profile_id is null then
    raise exception 'not_member' using errcode = '42501';
  end if;

  if coalesce(v_role, '') = 'viewer' then
    raise exception 'read_only' using errcode = '42501';
  end if;

  update public.tasks
  set owner_id = v_profile_id
  where id = claim_task.task_id
    and owner_id is null
    and coalesce(claimable, false) = true;

  if not found then
    raise exception 'already_claimed' using errcode = '23505';
  end if;
end;
$$;

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
  v_claimable boolean;
  v_auto boolean;
begin
  select s.organization_id, coalesce(s.required_slots, 1), coalesce(s.claimable, true), coalesce(s.auto_assign, false)
    into v_org_id, v_required, v_claimable, v_auto
  from public.shifts s
  where s.id = claim_shift_slot.shift_id;

  if v_org_id is null then
    raise exception 'shift_not_found' using errcode = 'P0002';
  end if;

  if v_auto = true or v_claimable = false then
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

create or replace function public.offer_task(task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_org_id uuid;
begin
  select t.organization_id into v_org_id
  from public.tasks t
  where t.id = offer_task.task_id;

  if v_org_id is null then
    raise exception 'task_not_found' using errcode = 'P0002';
  end if;

  select p.id into v_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.organization_id = v_org_id
    and coalesce(p.status, 'active') <> 'disabled'
  limit 1;

  if v_profile_id is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  update public.tasks
  set owner_id = null,
      claimable = true
  where id = offer_task.task_id
    and owner_id = v_profile_id;

  if not found then
    raise exception 'not_owner_or_not_found' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.offer_shift_swap(assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_org_id uuid;
begin
  select s.organization_id into v_org_id
  from public.shift_assignments sa
  join public.shifts s on s.id = sa.shift_id
  where sa.id = offer_shift_swap.assignment_id;

  if v_org_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select p.id into v_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.organization_id = v_org_id
    and coalesce(p.status, 'active') <> 'disabled'
  limit 1;

  if v_profile_id is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  update public.shift_assignments
  set swap_offered = true,
      swap_offered_at = now()
  where id = offer_shift_swap.assignment_id
    and user_id = v_profile_id
    and replacement_user_id is null;

  if not found then
    raise exception 'not_owner_or_not_found' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.claim_shift_swap(assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_shift_id uuid;
  v_org_id uuid;
begin
  select sa.shift_id into v_shift_id
  from public.shift_assignments sa
  where sa.id = claim_shift_swap.assignment_id
    and sa.swap_offered = true
    and sa.replacement_user_id is null;

  if v_shift_id is null then
    raise exception 'not_found_or_not_offered' using errcode = 'P0002';
  end if;

  select s.organization_id into v_org_id
  from public.shifts s
  where s.id = v_shift_id;

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

  update public.shift_assignments
  set replacement_user_id = v_profile_id,
      status = 'getauscht',
      swap_offered = false
  where id = claim_shift_swap.assignment_id
    and swap_offered = true
    and replacement_user_id is null;

  if not found then
    raise exception 'already_taken' using errcode = '23505';
  end if;
end;
$$;
