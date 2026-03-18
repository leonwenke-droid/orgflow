-- Add finance role and harden treasury RLS (no public reads)

do $$
begin
  if exists (select 1 from pg_type where typname = 'role') then
    begin
      alter type public.role add value 'finance';
    exception when duplicate_object then null;
    end;
  end if;
end
$$;

-- Treasury updates: remove legacy public read, restrict to finance/admin/lead/owner/super_admin in-org
do $$
begin
  begin
    drop policy if exists "treasury_public_read" on public.treasury_updates;
  exception when undefined_object then null;
  end;
end
$$;

drop policy if exists "treasury_updates_read_restricted" on public.treasury_updates;
create policy "treasury_updates_read_restricted"
  on public.treasury_updates for select
  using (
    public.is_super_admin()
    or (
      organization_id = public.current_user_organization_id()
      and exists (
        select 1 from public.profiles p
        where p.auth_user_id = auth.uid()
          and p.organization_id = treasury_updates.organization_id
          and p.status <> 'disabled'
          and p.role in ('admin', 'lead', 'owner', 'finance', 'super_admin')
      )
    )
  );

-- Writes: keep legacy name if present, but include finance + owner
drop policy if exists "treasury_admin_write" on public.treasury_updates;
create policy "treasury_updates_write_restricted"
  on public.treasury_updates for all
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.organization_id = treasury_updates.organization_id
        and p.status <> 'disabled'
        and p.role in ('admin', 'lead', 'owner', 'finance', 'super_admin')
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.organization_id = treasury_updates.organization_id
        and p.status <> 'disabled'
        and p.role in ('admin', 'lead', 'owner', 'finance', 'super_admin')
    )
  );

-- Treasury entries: restrict read to finance/admin/lead/owner/super_admin
drop policy if exists "treasury_entries_read_org_members" on public.treasury_entries;
create policy "treasury_entries_read_restricted"
  on public.treasury_entries for select
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.organization_id = treasury_entries.organization_id
        and p.status <> 'disabled'
        and p.role in ('admin', 'lead', 'owner', 'finance', 'super_admin')
    )
  );

drop policy if exists "treasury_entries_insert_admin_lead" on public.treasury_entries;
create policy "treasury_entries_insert_finance"
  on public.treasury_entries for insert
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.organization_id = treasury_entries.organization_id
        and p.status <> 'disabled'
        and p.role in ('admin', 'lead', 'owner', 'finance', 'super_admin')
    )
  );

drop policy if exists "treasury_entries_update_admin_lead" on public.treasury_entries;
create policy "treasury_entries_update_finance"
  on public.treasury_entries for update
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.organization_id = treasury_entries.organization_id
        and p.status <> 'disabled'
        and p.role in ('admin', 'lead', 'owner', 'finance', 'super_admin')
    )
  );

drop policy if exists "treasury_entries_delete_admin_lead" on public.treasury_entries;
create policy "treasury_entries_delete_finance"
  on public.treasury_entries for delete
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.organization_id = treasury_entries.organization_id
        and p.status <> 'disabled'
        and p.role in ('admin', 'lead', 'owner', 'finance', 'super_admin')
    )
  );

