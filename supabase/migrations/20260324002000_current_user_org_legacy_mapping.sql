-- Legacy compatibility: map TGG org slug to fixed TGG_ORG_ID for RLS helpers.
-- Without this, users whose profile.organization_id points to the "real" org row id
-- cannot read rows stored under the legacy fixed org id (aaaaaaaa-...).

create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
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
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and coalesce(p.status, 'active') <> 'disabled'
  limit 1;
$$;

create or replace function public.get_my_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_organization_id();
$$;

