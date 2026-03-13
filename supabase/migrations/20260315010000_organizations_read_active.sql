-- Allow resolving active organisations by slug for authenticated users too.
-- This fixes 404s when a logged-in user opens an org they don't belong to,
-- and ensures org listings work consistently regardless of auth state.

drop policy if exists "organizations_read" on public.organizations;
create policy "organizations_read"
on public.organizations for select
using (
  (auth.role() in ('anon', 'authenticated') and is_active = true)
  or public.is_super_admin()
  or id = public.current_user_organization_id()
);

