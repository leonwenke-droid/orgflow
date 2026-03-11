-- ============================================================================
-- handle_new_user: organization_id aus user_metadata nutzen (z. B. Claim-Org)
-- Wenn bei Signup organization_id in raw_user_meta_data übergeben wird und
-- die Org existiert, wird diese verwendet; sonst Default-Org (z. B. TGG).
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
begin
  -- Default-Org: aktiv, bevorzugt Slug abi-2026-tgg, sonst erste aktive
  select id into default_org_id
  from public.organizations
  where is_active = true
  order by case when slug = 'abi-2026-tgg' then 0 else 1 end,
           created_at asc
  limit 1;

  if default_org_id is null then
    raise exception 'Keine aktive Organisation – bitte zuerst eine Org anlegen (Super-Admin).';
  end if;

  -- Org aus Metadaten (z. B. Claim-Org-Registrierung): nur nutzen wenn gültige UUID und Org existiert
  begin
    meta_org_id := (new.raw_user_meta_data->>'organization_id')::uuid;
  exception when others then
    meta_org_id := null;
  end;
  if meta_org_id is not null and exists (select 1 from public.organizations where id = meta_org_id and is_active = true) then
    effective_org_id := meta_org_id;
  else
    effective_org_id := default_org_id;
  end if;

  if new.email is not null then
    select id into profile_id
    from public.profiles
    where email = new.email and auth_user_id is null
    limit 1;
    if profile_id is not null then
      update public.profiles
      set auth_user_id = new.id, organization_id = coalesce(organization_id, effective_org_id)
      where id = profile_id;
      return new;
    end if;
  end if;

  insert into public.profiles (id, full_name, role, auth_user_id, organization_id)
  values (
    gen_random_uuid(),
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1), 'Unbenannt'),
    'member',
    new.id,
    effective_org_id
  );
  return new;
end;
$$;
