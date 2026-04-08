-- Fix: material_procurements missing organization_id (PGRST204 schema cache error).
-- Add organization_id for multi-tenancy and align RLS with current org.

alter table public.material_procurements
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

-- Backfill from the creator profile when available (older rows had user_id NOT NULL).
update public.material_procurements mp
set organization_id = p.organization_id
from public.profiles p
where mp.organization_id is null
  and mp.user_id is not null
  and p.id = mp.user_id
  and p.organization_id is not null;

create index if not exists idx_material_procurements_org_created_at
  on public.material_procurements (organization_id, created_at desc);

-- Replace legacy policies (role-only) with org-scoped policies.
drop policy if exists "material_procurements_read_admin_lead" on public.material_procurements;
drop policy if exists "material_procurements_insert_admin_lead" on public.material_procurements;

create policy "material_procurements_read_org_admin"
on public.material_procurements for select
using (
  organization_id = public.current_user_organization_id()
  and public.is_org_admin(organization_id)
);

create policy "material_procurements_insert_org_admin"
on public.material_procurements for insert
with check (
  organization_id = public.current_user_organization_id()
  and public.is_org_admin(organization_id)
);

create policy "material_procurements_update_org_admin"
on public.material_procurements for update
using (
  organization_id = public.current_user_organization_id()
  and public.is_org_admin(organization_id)
)
with check (
  organization_id = public.current_user_organization_id()
  and public.is_org_admin(organization_id)
);

create policy "material_procurements_delete_org_admin"
on public.material_procurements for delete
using (
  organization_id = public.current_user_organization_id()
  and public.is_org_admin(organization_id)
);

