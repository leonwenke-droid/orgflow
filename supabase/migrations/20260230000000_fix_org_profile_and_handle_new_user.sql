-- ============================================================================
-- 1) handle_new_user: Neue User der Default-Org (TGG) zuweisen
--    (Ohne dies würde INSERT in profiles wegen NOT NULL organization_id scheitern.)
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

  if new.email is not null then
    select id into profile_id
    from public.profiles
    where email = new.email and auth_user_id is null
    limit 1;
    if profile_id is not null then
      update public.profiles
      set auth_user_id = new.id, organization_id = coalesce(organization_id, default_org_id)
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
    default_org_id
  );
  return new;
end;
$$;

-- ============================================================================
-- 2) Profile ohne gültige Org: der TGG-Org zuweisen (Backfill)
--    (Falls irgendwo organization_id fehlt oder auf gelöschte Org zeigt.)
-- ============================================================================

update public.profiles p
set organization_id = (
  select id from public.organizations where slug = 'abi-2026-tgg' and is_active = true limit 1
)
where p.organization_id is null
   or not exists (select 1 from public.organizations o where o.id = p.organization_id);

-- ============================================================================
-- 3) is_org_admin: Lead wie Admin behandeln (Zugriff auf Admin-Board & RLS)
-- ============================================================================

create or replace function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles
    where auth_user_id = auth.uid()
      and role in ('admin', 'lead', 'super_admin')
  );
$$;
