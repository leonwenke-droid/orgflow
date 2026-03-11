-- ============================================================================
-- RLS-Rekursion beheben: Eigenes Profil immer lesbar
-- OHNE DIESES SCRIPT: "stack depth limit exceeded", kein Dashboard, Redirect zu Login.
-- Supabase Dashboard → SQL Editor → dieses komplette Script einfügen → Run.
-- ============================================================================
-- current_user_organization_id() liest aus profiles → profiles_read prüft
-- current_user_organization_id() → Endlosschleife. Eigenes Profil (auth_user_id =
-- auth.uid()) immer erlauben, dann keine Rekursion.
-- ============================================================================

drop policy if exists "profiles_read" on public.profiles;

create policy "profiles_read"
on public.profiles for select
using (
  public.is_super_admin()
  or (auth_user_id = auth.uid())  /* eigenes Profil → keine Rekursion */
  or organization_id = public.current_user_organization_id()
);
