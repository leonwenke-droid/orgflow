-- Dashboard (Jahrgang) ist ohne Login erreichbar; dafür muss die Org per Slug
-- aufgelöst werden können. Anon darf aktive Organisationen lesen (nur für Slug-Lookup).
-- Admin und Super-Admin bleiben unverändert geschützt.

drop policy if exists "organizations_read" on public.organizations;
create policy "organizations_read"
on public.organizations for select
using (
  auth.role() = 'anon' and is_active = true
  or public.is_super_admin()
  or id = public.current_user_organization_id()
);
