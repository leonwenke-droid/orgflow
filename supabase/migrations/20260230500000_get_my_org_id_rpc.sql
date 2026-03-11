-- ============================================================================
-- RPC: Organisation des eingeloggten Users (umgeht RLS beim Redirect)
-- Zusätzlich 20260230400000_fix_rls_recursion_profiles_read.sql ausführen,
-- damit Tasks/Schichten/Daten geladen werden (current_user_organization_id).
-- ============================================================================

create or replace function public.get_my_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

comment on function public.get_my_organization_id() is 'Organisation des aktuellen Users; SECURITY DEFINER umgeht RLS-Rekursion.';
