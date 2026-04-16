-- Owner must have full access comparable to admin.
-- This migration patches older policies/functions that were missing the 'owner' role.

-- RPC: include owner as org admin
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

comment on function public.is_org_admin(uuid) is 'True wenn User Super-Admin oder Admin/Owner/Lead dieser Org; SECURITY DEFINER.';

-- shift_assignments: owner should count as admin
drop policy if exists "shift_assignments_read_self_or_admin" on public.shift_assignments;
create policy "shift_assignments_read_self_or_admin"
on public.shift_assignments
for select
using (
  user_id = public.current_profile_id()
  or public.current_profile_role() in ('admin', 'owner', 'lead')
);

-- treasury_entries: owner should be allowed to write (like admin/lead)
drop policy if exists "treasury_entries_insert_admin_lead" on public.treasury_entries;
create policy "treasury_entries_insert_admin_lead"
  on public.treasury_entries for insert
  with check (
    exists (
      select 1 from public.profiles
      where auth_user_id = auth.uid()
        and organization_id = treasury_entries.organization_id
        and role in ('admin', 'owner', 'lead')
    )
  );

drop policy if exists "treasury_entries_update_admin_lead" on public.treasury_entries;
create policy "treasury_entries_update_admin_lead"
  on public.treasury_entries for update
  using (
    exists (
      select 1 from public.profiles
      where auth_user_id = auth.uid()
        and organization_id = treasury_entries.organization_id
        and role in ('admin', 'owner', 'lead')
    )
  );

drop policy if exists "treasury_entries_delete_admin_lead" on public.treasury_entries;
create policy "treasury_entries_delete_admin_lead"
  on public.treasury_entries for delete
  using (
    exists (
      select 1 from public.profiles
      where auth_user_id = auth.uid()
        and organization_id = treasury_entries.organization_id
        and role in ('admin', 'owner', 'lead')
    )
  );

-- profile_committees: include owner
drop policy if exists "profile_committees_read_admin_lead_self" on public.profile_committees;
create policy "profile_committees_read_admin_lead_self"
on public.profile_committees
for select
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','owner','lead')
  )
);

drop policy if exists "profile_committees_admin_lead_write" on public.profile_committees;
create policy "profile_committees_admin_lead_write"
on public.profile_committees
for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','owner','lead')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','owner','lead')
  )
);

-- engagement_scores: include owner
drop policy if exists "engagement_scores_read_admin_lead" on public.engagement_scores;
create policy "engagement_scores_read_admin_lead"
on public.engagement_scores
for select
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','owner','lead')
  )
);

-- material_procurements: include owner
drop policy if exists "material_procurements_read_admin_lead" on public.material_procurements;
create policy "material_procurements_read_admin_lead"
  on public.material_procurements for select
  using (public.current_profile_role() in ('admin','owner','lead','super_admin'));

drop policy if exists "material_procurements_insert_admin_lead" on public.material_procurements;
create policy "material_procurements_insert_admin_lead"
  on public.material_procurements for insert
  with check (public.current_profile_role() in ('admin','owner','lead','super_admin'));

