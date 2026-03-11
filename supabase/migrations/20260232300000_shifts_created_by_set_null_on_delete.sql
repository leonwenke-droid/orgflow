-- Beim Löschen einer Organisation werden Profile gelöscht (Cascade von organization_id).
-- shifts.created_by und tasks.created_by referenzieren profiles(id); ohne ON DELETE SET NULL
-- blockiert das die Profil-Löschung. Wir setzen die FKs so, dass beim Löschen eines Profils
-- die Referenz auf NULL gesetzt wird.

-- shifts.created_by
do $$
declare
  c name;
begin
  for c in
    select pc.conname from pg_constraint pc
    join pg_attribute pa on pa.attrelid = pc.conrelid and pa.attnum = any(pc.conkey) and not pa.attisdropped
    where pc.conrelid = 'public.shifts'::regclass and pc.contype = 'f' and pa.attname = 'created_by'
  loop
    execute format('alter table public.shifts drop constraint if exists %I', c);
  end loop;
end $$;

alter table public.shifts
  add constraint shifts_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

-- tasks.created_by
do $$
declare
  c name;
begin
  for c in
    select pc.conname from pg_constraint pc
    join pg_attribute pa on pa.attrelid = pc.conrelid and pa.attnum = any(pc.conkey) and not pa.attisdropped
    where pc.conrelid = 'public.tasks'::regclass and pc.contype = 'f' and pa.attname = 'created_by'
  loop
    execute format('alter table public.tasks drop constraint if exists %I', c);
  end loop;
end $$;

alter table public.tasks
  add constraint tasks_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;
