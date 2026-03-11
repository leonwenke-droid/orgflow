-- Mehrere Komitee-Zugehörigkeiten pro Person (n:n).
create table if not exists profile_committees (
  user_id uuid not null references profiles(id) on delete cascade,
  committee_id uuid not null references committees(id) on delete cascade,
  primary key (user_id, committee_id)
);

comment on table profile_committees is 'Alle Komitee-Zugehörigkeiten pro Person (Ergänzung zu profiles.committee_id = primäres Komitee).';

create index if not exists idx_profile_committees_committee_id
  on profile_committees(committee_id);

alter table profile_committees enable row level security;

create policy "profile_committees_read_admin_lead_self"
on profile_committees
for select
using (
  auth.uid() = user_id
  or exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role in ('admin','lead')
  )
);

create policy "profile_committees_admin_lead_write"
on profile_committees
for all
using (
  exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role in ('admin','lead')
  )
)
with check (
  exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role in ('admin','lead')
  )
);
