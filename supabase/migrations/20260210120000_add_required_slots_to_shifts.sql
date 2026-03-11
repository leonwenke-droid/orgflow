-- Anzahl benötigter Personen pro Schicht
alter table shifts
  add column if not exists required_slots int not null default 0;

