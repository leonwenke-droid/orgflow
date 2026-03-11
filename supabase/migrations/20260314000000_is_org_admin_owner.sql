-- Include owner role in is_org_admin
create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where auth_user_id = auth.uid()
      and (
        role = 'super_admin'
        or (role in ('admin', 'owner', 'lead') and organization_id = org_id)
      )
  );
$$;
