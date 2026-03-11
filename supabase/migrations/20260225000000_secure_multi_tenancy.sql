-- ============================================================================
-- SICHERE MULTI-TENANCY MIGRATION
-- Erhält ALLE bestehenden Daten!
-- ============================================================================

-- ============================================================================
-- STEP 1: User Roles (Super-Admin, Admin, Member)
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('super_admin', 'admin', 'member');
    comment on type user_role is 'Super-Admin: Alle Orgs, Admin: Eine Org verwalten, Member: Teilnehmer';
  end if;
end
$$;

-- ============================================================================
-- STEP 2: Organizations Tabelle
-- ============================================================================

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  
  -- Identifikation
  name text not null,                         -- "Abitur 2027 - UEG"
  slug text unique not null,                  -- "abi-2027-ueg" (für URL)
  
  -- Schul-Info
  school_name text not null,                  -- "Ulrichsgymnasium Norden"
  school_short text,                          -- "UEG"
  school_city text,                           -- "Norden"
  school_address text,                        -- Optional: Vollständige Adresse
  
  -- Jahrgang
  year int not null,                          -- 2027
  
  -- Subdomain (für subdomain-routing)
  subdomain text unique,                      -- "ueg-2027" für ueg-2027.abiorga.app
  
  -- Settings (flexible Konfiguration pro Org)
  settings jsonb default '{
    "currency": "EUR",
    "timezone": "Europe/Berlin",
    "features": {
      "shifts": true,
      "tasks": true,
      "treasury": true,
      "engagement_tracking": true
    },
    "engagement_weights": {
      "task_done": 8,
      "shift_done": 10,
      "material_small": 5,
      "material_medium": 10,
      "material_large": 15
    },
    "contact_email": "",
    "contact_phone": ""
  }'::jsonb,
  
  -- Status
  is_active boolean default true,
  
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table organizations is 'Eine Organisation = Eine Schule + Ein Jahrgang';

-- Indizes für Performance
create unique index if not exists idx_org_slug on organizations(slug);
create unique index if not exists idx_org_subdomain on organizations(subdomain) where subdomain is not null;
create index if not exists idx_org_year on organizations(year);
create index if not exists idx_org_active on organizations(is_active) where is_active = true;

-- Updated_at Trigger
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger trg_organizations_updated_at
before update on organizations
for each row
execute function set_updated_at();

-- ============================================================================
-- STEP 3: Bestehende Tabellen SICHER erweitern
-- ============================================================================

-- WICHTIG: Erst nullable, dann Migration, dann NOT NULL!

-- PROFILES: Role hinzufügen
alter table profiles 
add column if not exists role user_role default 'member',
add column if not exists organization_id uuid references organizations(id) on delete cascade;

-- COMMITTEES
alter table committees 
add column if not exists organization_id uuid references organizations(id) on delete cascade,
add column if not exists is_default boolean default false;

-- TASKS
alter table tasks 
add column if not exists organization_id uuid references organizations(id) on delete cascade;

-- SHIFTS
alter table shifts 
add column if not exists organization_id uuid references organizations(id) on delete cascade;

-- ENGAGEMENT_SCORES
alter table engagement_scores
add column if not exists organization_id uuid references organizations(id) on delete cascade;

-- TREASURY_UPDATES
alter table treasury_updates 
add column if not exists organization_id uuid references organizations(id) on delete cascade;

-- Performance-Indizes
create index if not exists idx_profiles_org on profiles(organization_id);
create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_committees_org on committees(organization_id);
create index if not exists idx_tasks_org on tasks(organization_id);
create index if not exists idx_shifts_org on shifts(organization_id);
create index if not exists idx_treasury_org on treasury_updates(organization_id);
create index if not exists idx_engagement_scores_org on engagement_scores(organization_id);

-- ============================================================================
-- STEP 4: SICHERE DATEN MIGRATION - Bestehende Org erstellen
-- ============================================================================

-- Feste UUID für die bestehende Organisation (Abi 2026 UEG)
insert into organizations (
  id,
  name,
  slug,
  subdomain,
  school_name,
  school_short,
  school_city,
  year,
  is_active
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Abitur 2026 - Ulrichsgymnasium Norden',
  'abi-2026-ueg',
  'ueg-2026',
  'Ulrichsgymnasium Norden',
  'UEG',
  'Norden',
  2026,
  true
)
on conflict (id) do nothing;  -- Verhindert Fehler bei erneutem Run

-- ============================================================================
-- STEP 5: ALLE bestehenden Daten der Default-Org zuweisen
-- ============================================================================

-- PROFILES (erhält alle Scores!)
update profiles 
set organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where organization_id is null;

-- COMMITTEES
update committees 
set organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where organization_id is null and (is_default is null or is_default = false);

-- TASKS
update tasks 
set organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where organization_id is null;

-- SHIFTS
update shifts 
set organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where organization_id is null;

-- TREASURY_UPDATES
update treasury_updates 
set organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where organization_id is null;

-- ENGAGEMENT_SCORES (KRITISCH - Diese müssen erhalten bleiben!)
update engagement_scores 
set organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where organization_id is null;

-- ============================================================================
-- STEP 6: Template-Komitees für neue Organisationen
-- ============================================================================

insert into committees (name, is_default) values
  ('Jahrgangssprecher', true),
  ('Finanzkomitee', true),
  ('Veranstaltungskomitee', true),
  ('Abiball-Komitee', true),
  ('Mottowoche-Komitee', true),
  ('Abibuch-Komitee', true),
  ('Socialmedia-Komitee', true),
  ('Abistreich-Komitee', true)
on conflict do nothing;

-- ============================================================================
-- STEP 7: Jetzt NOT NULL constraints setzen (NACH Migration!)
-- ============================================================================

alter table profiles alter column organization_id set not null;
alter table tasks alter column organization_id set not null;
alter table shifts alter column organization_id set not null;
alter table treasury_updates alter column organization_id set not null;
-- committees nicht NOT NULL wegen Templates

-- ============================================================================
-- STEP 8: Row Level Security (RLS)
-- ============================================================================

create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- Helper: Ist User Super-Admin?
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles
    where auth_user_id = auth.uid()
      and role = 'super_admin'
  );
$$;

-- Helper: Ist User Admin seiner Org?
create or replace function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles
    where auth_user_id = auth.uid()
      and role in ('admin', 'super_admin')
  );
$$;

-- ORGANIZATIONS: Super-Admins sehen alle, andere nur ihre eigene
drop policy if exists "organizations_read" on organizations;
create policy "organizations_read"
on organizations for select
using (
  public.is_super_admin()
  or id = public.current_user_organization_id()
);

-- PROFILES: Nur eigene Org sehen (Super-Admin sieht alle)
drop policy if exists "profiles_read" on profiles;
create policy "profiles_read"
on profiles for select
using (
  public.is_super_admin()
  or organization_id = public.current_user_organization_id()
);

-- Admins können Profile ihrer Org bearbeiten
drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin"
on profiles for update
using (
  public.is_super_admin()
  or (
    public.is_org_admin()
    and organization_id = public.current_user_organization_id()
  )
);

-- COMMITTEES: Eigene Org + Templates
drop policy if exists "committees_read" on committees;
create policy "committees_read"
on committees for select
using (
  public.is_super_admin()
  or organization_id = public.current_user_organization_id()
  or is_default = true
);

-- Admins können Komitees erstellen
drop policy if exists "committees_insert_admin" on committees;
create policy "committees_insert_admin"
on committees for insert
with check (
  public.is_super_admin()
  or (
    public.is_org_admin()
    and organization_id = public.current_user_organization_id()
  )
);

-- TASKS, SHIFTS, etc: Nur eigene Org (Super-Admin alle)
drop policy if exists "tasks_read" on tasks;
create policy "tasks_read"
on tasks for select
using (
  public.is_super_admin()
  or organization_id = public.current_user_organization_id()
);

drop policy if exists "shifts_read" on shifts;
create policy "shifts_read"
on shifts for select
using (
  public.is_super_admin()
  or organization_id = public.current_user_organization_id()
);

drop policy if exists "engagement_scores_read" on engagement_scores;
create policy "engagement_scores_read"
on engagement_scores for select
using (
  public.is_super_admin()
  or organization_id = public.current_user_organization_id()
);

-- Enable RLS
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table committees enable row level security;
alter table tasks enable row level security;
alter table shifts enable row level security;
alter table engagement_scores enable row level security;
alter table treasury_updates enable row level security;

-- ============================================================================
-- STEP 9: Verification Query (zur Sicherheit!)
-- ============================================================================

-- Diese Query sollte deine bestehenden Daten zeigen:
-- select 
--   'profiles' as table_name,
--   count(*) as total,
--   count(case when organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' then 1 end) as migrated
-- from profiles
-- union all
-- select 'engagement_scores', count(*), count(case when organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' then 1 end)
-- from engagement_scores
-- union all
-- select 'tasks', count(*), count(case when organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' then 1 end)
-- from tasks;

