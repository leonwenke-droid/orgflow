-- 1) engagement_events: Neue Typen für Materialbeschaffung (material_small/medium/large)
do $$
declare
  c name;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'engagement_events'::regclass and contype = 'c'
  loop
    execute format('alter table engagement_events drop constraint if exists %I', c);
  end loop;
end $$;

alter table engagement_events
  add constraint engagement_events_event_type_check
  check (event_type in (
    'task_done','shift_done','sponsoring_success','lead_weekly','task_late','shift_missed','task_missed','score_import','replacement_arranged',
    'material_small','material_medium','material_large'
  ));

-- 2) Tabelle für Materialbeschaffungen (Historie + Verknüpfung zu engagement_events)
create table material_procurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  event_name text not null,
  item_description text not null,
  size text not null check (size in ('small','medium','large')),
  proof_url text,
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  created_at timestamptz default now()
);

comment on table material_procurements is 'Erfasste Materialbeschaffungen; fließen via engagement_events in den Engagement-Score.';

alter table material_procurements enable row level security;

create policy "material_procurements_read_admin_lead"
on material_procurements for select
using (current_profile_role() in ('admin','lead'));

create policy "material_procurements_insert_admin_lead"
on material_procurements for insert
with check (current_profile_role() in ('admin','lead'));
