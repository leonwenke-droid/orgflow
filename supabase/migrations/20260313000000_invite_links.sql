-- Invite links for organisation membership
create table if not exists invite_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  token text unique not null,
  created_by uuid references profiles(id) on delete set null,
  expires_at timestamptz,
  max_uses int default 1,
  use_count int default 0,
  created_at timestamptz default now()
);

-- Note: Partial index with now() fails (now() not immutable). Use simple index on token.
create index if not exists idx_invite_links_org on invite_links(organization_id);

alter table invite_links enable row level security;

-- Only org admins can manage invite links
create policy "invite_links_admin_all"
on invite_links for all
using (
  exists (
    select 1 from profiles
    where auth_user_id = auth.uid()
      and organization_id = invite_links.organization_id
      and role in ('admin', 'owner', 'lead', 'super_admin')
  )
)
with check (
  exists (
    select 1 from profiles
    where auth_user_id = auth.uid()
      and organization_id = invite_links.organization_id
      and role in ('admin', 'owner', 'lead', 'super_admin')
  )
);
