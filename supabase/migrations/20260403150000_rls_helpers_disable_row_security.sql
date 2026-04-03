-- Fix: 54001 "stack depth limit exceeded" when selecting public.profiles under RLS.
-- SECURITY DEFINER helpers that SELECT from profiles still evaluate RLS on profiles
-- unless the role bypasses RLS. That re-enters policies that call the same helpers → recursion.
-- Solution: read profiles inside these helpers with row_security disabled (session-local to the call).
--
-- Do NOT drop is_org_admin(uuid): RLS policies on events, feature_requests, audit_logs, etc.
-- reference it; DROP would require CASCADE and would remove those policies. Use CREATE OR REPLACE only.

create or replace function public.current_user_organization_id()
returns uuid
language plpgsql
stable
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
stable
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
stable
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
