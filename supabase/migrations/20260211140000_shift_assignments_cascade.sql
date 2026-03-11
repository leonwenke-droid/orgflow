-- Beim Löschen einer Schicht werden Zuweisungen mitgelöscht
alter table shift_assignments
  drop constraint if exists shift_assignments_shift_id_fkey;

alter table shift_assignments
  add constraint shift_assignments_shift_id_fkey
  foreign key (shift_id) references shifts(id) on delete cascade;
