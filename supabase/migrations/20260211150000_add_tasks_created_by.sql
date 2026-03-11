-- Who created/issued the task (Aussteller)
alter table tasks
  add column if not exists created_by uuid references profiles(id);

comment on column tasks.created_by is 'User (profile) who created/issued the task';
