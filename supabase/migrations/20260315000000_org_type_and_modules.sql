-- Add org_type for generic organisation management (School, Club, NGO, etc.)
alter table public.organizations
  add column if not exists org_type text default 'other'
  check (org_type in ('school', 'club', 'sports_club', 'volunteer_group', 'event_crew', 'ngo', 'conference', 'custom', 'other'));

comment on column public.organizations.org_type is 'Organisation type: school, club, volunteer_group, event_crew, ngo, conference, custom, other';

-- Ensure settings.features supports all modules (tasks, shifts, treasury, resources, engagement_tracking, events)
-- Existing orgs keep current settings; new orgs get modules from wizard
-- No data migration needed - default settings already have shifts, tasks, treasury, engagement_tracking
