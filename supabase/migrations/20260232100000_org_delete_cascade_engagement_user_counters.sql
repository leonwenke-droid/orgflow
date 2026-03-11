-- Beim Löschen einer Organisation werden alle zugehörigen Daten mitgelöscht.
-- profiles, committees, tasks, shifts, engagement_scores, treasury_updates haben bereits
-- organization_id REFERENCES organizations(id) ON DELETE CASCADE.
-- Damit beim Löschen von profiles (durch Org-Cascade) keine FK-Fehler entstehen,
-- ergänzen wir ON DELETE CASCADE für Tabellen, die profiles referenzieren.

-- engagement_events.user_id -> profiles(id): mit CASCADE
do $$
declare
  c name;
begin
  for c in
    select pc.conname from pg_constraint pc
    join pg_attribute pa on pa.attrelid = pc.conrelid and pa.attnum = any(pc.conkey) and not pa.attisdropped
    where pc.conrelid = 'public.engagement_events'::regclass and pc.contype = 'f' and pa.attname = 'user_id'
  loop
    execute format('alter table public.engagement_events drop constraint if exists %I', c);
  end loop;
end $$;
alter table public.engagement_events
  add constraint engagement_events_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- user_counters.user_id -> profiles(id): mit CASCADE
do $$
declare
  c name;
begin
  for c in
    select pc.conname from pg_constraint pc
    join pg_attribute pa on pa.attrelid = pc.conrelid and pa.attnum = any(pc.conkey) and not pa.attisdropped
    where pc.conrelid = 'public.user_counters'::regclass and pc.contype = 'f' and pa.attname = 'user_id'
  loop
    execute format('alter table public.user_counters drop constraint if exists %I', c);
  end loop;
end $$;
alter table public.user_counters
  add constraint user_counters_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
