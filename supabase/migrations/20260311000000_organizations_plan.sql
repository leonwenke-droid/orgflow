-- Add plan column for SaaS pricing (Free, Team, Pro)
alter table public.organizations
  add column if not exists plan text default 'free'
  check (plan in ('free', 'team', 'pro'));

comment on column public.organizations.plan is 'SaaS plan: free, team, pro';
