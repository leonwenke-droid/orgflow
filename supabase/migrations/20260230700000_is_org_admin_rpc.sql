-- ============================================================================
-- RPC: Prüft, ob der aktuelle User Admin/Lead der angegebenen Organisation ist
-- (oder Super-Admin). Für Zugriff auf /[org]/admin ohne Profil-Lesen (RLS).
-- ============================================================================

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
        or (role in ('admin', 'lead') and organization_id = org_id)
      )
  );
$$;

comment on function public.is_org_admin(uuid) is 'True wenn User Super-Admin oder Admin/Lead dieser Org; SECURITY DEFINER.';
