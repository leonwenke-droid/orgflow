-- ENUM TYPES
create type role as enum ('admin','lead','member');
create type task_status as enum ('offen','in_arbeit','erledigt');
create type shift_status as enum ('zugewiesen','bestätigt','getauscht','abgesagt','erledigt');

-- TABLES
create table if not exists committees (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists profiles (
  id uuid primary key references auth.users(id),
  full_name text not null,
  role role not null default 'member',
  committee_id uuid references committees(id)
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  committee_id uuid references committees(id),
  owner_id uuid references profiles(id),
  due_at timestamptz,
  status task_status default 'offen',
  proof_required boolean default true,
  proof_url text,
  access_token text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint tasks_proof_check
    check (not (proof_required = true and status = 'erledigt' and proof_url is null))
);

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  location text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists shift_assignments (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references shifts(id),
  user_id uuid references profiles(id),
  status shift_status default 'zugewiesen',
  replacement_user_id uuid references profiles(id),
  proof_url text,
  created_at timestamptz default now()
);

create table if not exists engagement_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  event_type text check (event_type in (
    'task_done','shift_done','sponsoring_success','lead_weekly','task_late','shift_missed'
  )),
  points int not null,
  source_id uuid,
  created_at timestamptz default now()
);

create table if not exists committee_stats (
  committee_id uuid primary key references committees(id),
  open_tasks int default 0,
  in_progress_tasks int default 0,
  completed_tasks int default 0,
  overdue_tasks int default 0,
  performance_score float default 0,
  updated_at timestamptz default now()
);

create table if not exists treasury_updates (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null,
  source text default 'Excel Upload',
  updated_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- STORAGE BUCKET FOR TASK PROOFS
insert into storage.buckets (id, name, public)
values ('task_proofs', 'task_proofs', true)
on conflict (id) do nothing;

-- ENGAGEMENT SCORE VIEW / FUNCTION
create or replace view engagement_scores as
select
  user_id,
  coalesce(sum(points), 0) as score
from engagement_events
group by user_id;

create or replace function get_engagement_scores()
returns table (user_id uuid, score int)
language sql
as $$
  select user_id, score from engagement_scores;
$$;

-- TRIGGERS: UPDATED_AT ON TASKS
create or replace function set_tasks_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_set_updated_at on tasks;
create trigger trg_tasks_set_updated_at
before update on tasks
for each row
execute procedure set_tasks_updated_at();

-- TRIGGERS: ENGAGEMENT EVENTS FOR TASKS
create or replace function handle_task_engagement()
returns trigger as $$
declare
  base_points int := 8;
begin
  if (tg_op = 'UPDATE') then
    if new.status = 'erledigt' and (old.status is distinct from new.status) then
      insert into engagement_events (user_id, event_type, points, source_id)
      values (new.owner_id, 'task_done', base_points, new.id);

      if new.due_at is not null and new.due_at < now() then
        insert into engagement_events (user_id, event_type, points, source_id)
        values (new.owner_id, 'task_late', -3, new.id);
      end if;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_task_engagement on tasks;
create trigger trg_task_engagement
after update on tasks
for each row
execute procedure handle_task_engagement();

-- TRIGGERS: ENGAGEMENT EVENTS FOR SHIFTS
create or replace function handle_shift_engagement()
returns trigger as $$
begin
  if (tg_op = 'UPDATE') then
    if new.status = 'erledigt' and (old.status is distinct from new.status) then
      insert into engagement_events (user_id, event_type, points, source_id)
      values (new.user_id, 'shift_done', 10, new.id);
    elsif new.status = 'abgesagt' and (old.status is distinct from new.status) then
      insert into engagement_events (user_id, event_type, points, source_id)
      values (new.user_id, 'shift_missed', -15, new.id);
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_shift_engagement on shift_assignments;
create trigger trg_shift_engagement
after update on shift_assignments
for each row
execute procedure handle_shift_engagement();

-- TRIGGERS: COMMITTEE STATS
create or replace function recompute_committee_stats(p_committee_id uuid)
returns void as $$
declare
  v_open int;
  v_in_progress int;
  v_completed int;
  v_overdue int;
  v_total int;
  v_score float;
begin
  select
    count(*) filter (where status = 'offen'),
    count(*) filter (where status = 'in_arbeit'),
    count(*) filter (where status = 'erledigt'),
    count(*) filter (where status <> 'erledigt' and due_at is not null and due_at < now())
  into v_open, v_in_progress, v_completed, v_overdue
  from tasks
  where committee_id = p_committee_id;

  v_total := coalesce(v_open,0) + coalesce(v_in_progress,0) + coalesce(v_completed,0) + coalesce(v_overdue,0);
  if v_total > 0 then
    v_score := coalesce(v_completed,0)::float / v_total::float * 100.0;
  else
    v_score := 0;
  end if;

  insert into committee_stats (committee_id, open_tasks, in_progress_tasks, completed_tasks, overdue_tasks, performance_score, updated_at)
  values (p_committee_id, coalesce(v_open,0), coalesce(v_in_progress,0), coalesce(v_completed,0), coalesce(v_overdue,0), v_score, now())
  on conflict (committee_id) do update
    set open_tasks = excluded.open_tasks,
        in_progress_tasks = excluded.in_progress_tasks,
        completed_tasks = excluded.completed_tasks,
        overdue_tasks = excluded.overdue_tasks,
        performance_score = excluded.performance_score,
        updated_at = excluded.updated_at;
end;
$$ language plpgsql;

create or replace function trg_recompute_committee_stats()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    perform recompute_committee_stats(new.committee_id);
  elsif (tg_op = 'UPDATE') then
    if new.committee_id is distinct from old.committee_id then
      perform recompute_committee_stats(old.committee_id);
    end if;
    perform recompute_committee_stats(new.committee_id);
  elsif (tg_op = 'DELETE') then
    perform recompute_committee_stats(old.committee_id);
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_recompute_committee_stats on tasks;
create trigger trg_tasks_recompute_committee_stats
after insert or update or delete on tasks
for each row
execute procedure trg_recompute_committee_stats();

-- FINANCIAL TARGET CHECK FUNCTION
create or replace function check_financial_target()
returns table (ok boolean, total numeric, target_min numeric, target_max numeric, deadline date)
language plpgsql
as $$
declare
  v_total numeric;
  v_deadline date := coalesce(
    nullif(current_setting('abi_orga.financial_deadline', true), '')::date,
    date '2026-05-01'
  );
  v_min numeric := coalesce(
    nullif(current_setting('abi_orga.financial_target_min', true), '')::numeric,
    11000
  );
  v_max numeric := coalesce(
    nullif(current_setting('abi_orga.financial_target_max', true), '')::numeric,
    13000
  );
begin
  select coalesce(sum(amount), 0) into v_total from treasury_updates;
  return query
  select
    (current_date < v_deadline or v_total between v_min and v_max) as ok,
    v_total,
    v_min,
    v_max,
    v_deadline;
end;
$$;

-- RLS POLICIES
alter table committees enable row level security;
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table shifts enable row level security;
alter table shift_assignments enable row level security;
alter table engagement_events enable row level security;
alter table committee_stats enable row level security;
alter table treasury_updates enable row level security;

-- Helper: get profile role
create or replace function current_profile_role()
returns role
language sql
stable
as $$
  select p.role
  from profiles p
  where p.id = auth.uid();
$$;

-- PROFILES
create policy "profiles_self_select"
on profiles
for select
using (id = auth.uid() or current_profile_role() in ('admin','lead'));

create policy "profiles_admin_update"
on profiles
for all
using (current_profile_role() = 'admin')
with check (current_profile_role() = 'admin');

-- COMMITTEES
create policy "committees_read_all"
on committees
for select
using (true);

create policy "committees_admin_write"
on committees
for all
using (current_profile_role() in ('admin','lead'))
with check (current_profile_role() in ('admin','lead'));

-- TASKS: only admin/lead via auth, plus service role bypass
create policy "tasks_admin_lead_read"
on tasks
for select
using (current_profile_role() in ('admin','lead'));

create policy "tasks_admin_lead_write"
on tasks
for all
using (current_profile_role() in ('admin','lead'))
with check (current_profile_role() in ('admin','lead'));

-- SHIFTS
create policy "shifts_read_all"
on shifts
for select
using (true);

create policy "shifts_admin_lead_write"
on shifts
for all
using (current_profile_role() in ('admin','lead'))
with check (current_profile_role() in ('admin','lead'));

-- SHIFT ASSIGNMENTS
create policy "shift_assignments_read_self_or_admin"
on shift_assignments
for select
using (user_id = auth.uid() or current_profile_role() in ('admin','lead'));

create policy "shift_assignments_admin_write"
on shift_assignments
for all
using (current_profile_role() in ('admin','lead'))
with check (current_profile_role() in ('admin','lead'));

-- ENGAGEMENT EVENTS: admins/leads only
create policy "engagement_admin_read"
on engagement_events
for select
using (current_profile_role() in ('admin','lead'));

create policy "engagement_admin_write"
on engagement_events
for all
using (current_profile_role() in ('admin','lead'))
with check (current_profile_role() in ('admin','lead'));

-- COMMITTEE STATS: public read, admin/lead manage
create policy "committee_stats_public_read"
on committee_stats
for select
using (true);

create policy "committee_stats_admin_write"
on committee_stats
for all
using (current_profile_role() in ('admin','lead'))
with check (current_profile_role() in ('admin','lead'));

-- TREASURY UPDATES: public read aggregate, admin/lead write
create policy "treasury_public_read"
on treasury_updates
for select
using (true);

create policy "treasury_admin_write"
on treasury_updates
for all
using (current_profile_role() in ('admin','lead'))
with check (current_profile_role() in ('admin','lead'));

