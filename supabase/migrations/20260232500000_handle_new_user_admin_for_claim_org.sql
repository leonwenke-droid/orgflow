-- ============================================================================
-- handle_new_user: Bei Claim-Org-Signup (organization_id aus user_metadata)
-- Profil mit Admin-Rolle anlegen, damit nach Verifizierung direkt gehandelt werden kann.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
  default_org_id uuid;
  meta_org_id uuid;
  effective_org_id uuid;
  initial_role text;
begin
  select id into default_org_id
  from public.organizations
  where is_active = true
  order by case when slug = 'abi-2026-tgg' then 0 else 1 end,
           created_at asc
  limit 1;

  if default_org_id is null then
    raise exception 'Keine aktive Organisation – bitte zuerst eine Org anlegen (Super-Admin).';
  end if;

  begin
    meta_org_id := (new.raw_user_meta_data->>'organization_id')::uuid;
  exception when others then
    meta_org_id := null;
  end;
  if meta_org_id is not null and exists (select 1 from public.organizations where id = meta_org_id and is_active = true) then
    effective_org_id := meta_org_id;
    initial_role := 'admin';
  else
    effective_org_id := default_org_id;
    initial_role := 'member';
  end if;

  if new.email is not null then
    select id into profile_id
    from public.profiles
    where email = new.email and auth_user_id is null
    limit 1;
    if profile_id is not null then
      update public.profiles
      set auth_user_id = new.id, organization_id = coalesce(organization_id, effective_org_id),
          role = case when meta_org_id is not null then 'admin'::public.role else role end
      where id = profile_id;
      return new;
    end if;
  end if;

  insert into public.profiles (id, full_name, role, auth_user_id, organization_id)
  values (
    gen_random_uuid(),
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1), 'Unbenannt'),
    initial_role::public.role,
    new.id,
    effective_org_id
  );
  return new;
end;
$$;
