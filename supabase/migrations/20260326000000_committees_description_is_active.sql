-- Teams (committees): optional description + active flag for richer admin UX

alter table public.committees
  add column if not exists description text,
  add column if not exists is_active boolean not null default true;

comment on column public.committees.description is 'Optional team description shown in admin.';
comment on column public.committees.is_active is 'When false, team is hidden or de-emphasised in UI (soft deactivation).';
