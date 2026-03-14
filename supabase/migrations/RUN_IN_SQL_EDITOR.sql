-- ============================================================
-- Run in Supabase Dashboard → SQL Editor (one block at a time or all)
-- ============================================================

-- --- 1) org_type and modules ---
alter table public.organizations
  add column if not exists org_type text default 'other'
  check (org_type in ('school', 'club', 'sports_club', 'volunteer_group', 'event_crew', 'ngo', 'conference', 'custom', 'other'));

comment on column public.organizations.org_type is 'Organisation type: school, club, volunteer_group, event_crew, ngo, conference, custom, other';

-- --- 2) organizations_read policy ---
drop policy if exists "organizations_read" on public.organizations;
create policy "organizations_read"
on public.organizations for select
using (
  (auth.role() in ('anon', 'authenticated') and is_active = true)
  or public.is_super_admin()
  or id = public.current_user_organization_id()
);

-- --- 3) events entity ---
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  start_date date,
  end_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, slug)
);

create index if not exists idx_events_org on public.events(organization_id);

alter table public.shifts
  add column if not exists event_id uuid references public.events(id) on delete set null;

alter table public.tasks
  add column if not exists event_id uuid references public.events(id) on delete set null;

comment on table public.events is 'Events can group shifts, tasks and resources (e.g. Summer Festival 2026).';

alter table public.events enable row level security;

create policy "events_read"
  on public.events for select
  using (
    organization_id = public.current_user_organization_id()
    or public.is_super_admin()
  );

create policy "events_admin_write"
  on public.events for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));
