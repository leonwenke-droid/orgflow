-- Materialbeschaffung: Mehrere Personen pro Eintrag möglich.
-- Jede ausgewählte Person erhält die volle Punktezahl für die Größe.

-- 1) Teilnehmer-Tabelle (n:n)
create table material_procurement_participants (
  material_id uuid not null references material_procurements(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (material_id, user_id)
);

create index idx_mpp_material_id on material_procurement_participants(material_id);
create index idx_mpp_user_id on material_procurement_participants(user_id);

comment on table material_procurement_participants is 'Pro Materialbeschaffung können mehrere Personen erfasst werden; jede erhält die Punkte.';

-- 2) Bestehende Einträge migrieren (user_id → participants)
insert into material_procurement_participants (material_id, user_id)
select id, user_id from material_procurements where user_id is not null;

-- 3) user_id in material_procurements optional machen (für Abwärtskompatibilität, neue Einträge nutzen nur participants)
alter table material_procurements alter column user_id drop not null;

alter table material_procurement_participants enable row level security;

create policy "mpp_read_admin_lead"
on material_procurement_participants for select
using (current_profile_role() in ('admin','lead'));

create policy "mpp_insert_admin_lead"
on material_procurement_participants for insert
with check (current_profile_role() in ('admin','lead'));
