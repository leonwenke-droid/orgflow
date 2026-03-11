-- Engagement-Scores als Tabelle in der DB pflegen (bisher nur View).
-- Die Tabelle wird durch Trigger auf engagement_events aktuell gehalten.

-- View entfernen, Tabelle anlegen (gleicher Name für App-Kompatibilität)
drop view if exists engagement_scores;

create table engagement_scores (
  user_id uuid primary key references profiles(id) on delete cascade,
  score int not null default 0,
  updated_at timestamptz not null default now()
);

comment on table engagement_scores is 'Aggregierte Engagement-Punkte pro User, gepflegt per Trigger aus engagement_events';

-- Trigger: Bei Änderung in engagement_events den Score für betroffene User neu berechnen
create or replace function refresh_engagement_score(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into engagement_scores (user_id, score, updated_at)
  select p_user_id, coalesce(sum(points), 0), now()
  from engagement_events
  where user_id = p_user_id
  on conflict (user_id) do update
  set score = excluded.score, updated_at = excluded.updated_at;
end;
$$;

create or replace function handle_engagement_events_sync()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    perform refresh_engagement_score(new.user_id);
  elsif (tg_op = 'UPDATE') then
    if old.user_id is distinct from new.user_id then
      perform refresh_engagement_score(old.user_id);
    end if;
    perform refresh_engagement_score(new.user_id);
  elsif (tg_op = 'DELETE') then
    perform refresh_engagement_score(old.user_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_engagement_events_sync on engagement_events;
create trigger trg_engagement_events_sync
after insert or update or delete on engagement_events
for each row
execute function handle_engagement_events_sync();

-- Bestehende Scores aus engagement_events einpflegen
insert into engagement_scores (user_id, score, updated_at)
select user_id, coalesce(sum(points), 0), now()
from engagement_events
group by user_id
on conflict (user_id) do update
set score = excluded.score, updated_at = excluded.updated_at;

-- Lese-Zugriff für alle (wie bisher View), Schreiben nur indirekt über engagement_events
alter table engagement_scores enable row level security;

create policy "engagement_scores_read_admin_lead"
on engagement_scores
for select
using (
  auth.uid() = user_id
  or exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role in ('admin','lead')
  )
);

-- Service Role / App liest mit Service-Key ohnehin ohne RLS-Einschränkung
