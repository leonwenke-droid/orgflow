-- Einnahmen-/Ausgaben-Log pro Organisation (optional; Kassenstand weiterhin über treasury_updates).
create table if not exists treasury_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  date date not null default current_date,
  description text not null default '',
  amount_cents bigint not null,
  type text not null check (type in ('income', 'expense')),
  category text,
  created_at timestamptz default now(),
  created_by uuid references profiles(id) on delete set null
);

create index if not exists idx_treasury_entries_org_date on treasury_entries(organization_id, date desc);

alter table treasury_entries enable row level security;

create policy "treasury_entries_read_org_members"
  on treasury_entries for select
  using (
    organization_id in (
      select organization_id from profiles
      where auth_user_id = auth.uid()
    )
  );

create policy "treasury_entries_insert_admin_lead"
  on treasury_entries for insert
  with check (
    exists (
      select 1 from profiles
      where auth_user_id = auth.uid()
        and organization_id = treasury_entries.organization_id
        and role in ('admin', 'lead')
    )
  );

create policy "treasury_entries_update_admin_lead"
  on treasury_entries for update
  using (
    exists (
      select 1 from profiles
      where auth_user_id = auth.uid()
        and organization_id = treasury_entries.organization_id
        and role in ('admin', 'lead')
    )
  );

create policy "treasury_entries_delete_admin_lead"
  on treasury_entries for delete
  using (
    exists (
      select 1 from profiles
      where auth_user_id = auth.uid()
        and organization_id = treasury_entries.organization_id
        and role in ('admin', 'lead')
    )
  );

comment on table treasury_entries is 'Income/expense line items per organization; balance can still be updated via treasury_updates.';
