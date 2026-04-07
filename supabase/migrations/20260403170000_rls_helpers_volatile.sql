-- PostgreSQL: SET / SET LOCAL is only allowed in VOLATILE functions.
-- STABLE helpers with "set local row_security = off" fail at runtime (0A000).

create or replace function public.current_user_organization_id()
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  set local row_security = off;
  select
    case
      when exists (
        select 1
        from public.organizations o
        where o.id = p.organization_id
          and o.slug in ('abi-2026-tgg', 'abi2026-tgg')
      ) then 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
      else p.organization_id
    end
  into v_org
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and coalesce(p.status, 'active') <> 'disabled'
  limit 1;
  return v_org;
end;
$$;

create or replace function public.is_super_admin()
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  set local row_security = off;
  return exists (
    select 1
    from public.profiles
    where auth_user_id = auth.uid()
      and role = 'super_admin'
  );
end;
$$;

create or replace function public.is_org_admin(org_id uuid default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  set local row_security = off;
  return exists (
    select 1
    from public.profiles
    where auth_user_id = auth.uid()
      and coalesce(status, 'active') <> 'disabled'
      and role in ('admin', 'owner', 'lead', 'teamlead', 'super_admin')
      and (org_id is null or organization_id = org_id)
  );
end;
$$;
