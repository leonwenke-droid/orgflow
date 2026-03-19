-- Link materials/resources to events (optional)
alter table public.material_procurements
  add column if not exists event_id uuid references public.events(id) on delete set null;

create index if not exists idx_material_procurements_event_id
  on public.material_procurements(event_id)
  where event_id is not null;

