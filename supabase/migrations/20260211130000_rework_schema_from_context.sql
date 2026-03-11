-- Additional schema adjustments based on CONTEXT.md

-- Extend profiles with contact / opt-in fields
alter table profiles
  add column if not exists phone text,
  add column if not exists is_whitelisted boolean not null default false,
  add column if not exists opt_in boolean not null default false,
  add column if not exists activated_at timestamptz,
  add column if not exists last_contact_at timestamptz;

-- user_counters: load_index and responsibility_malus per user
create table if not exists user_counters (
  user_id uuid primary key references profiles(id),
  load_index numeric not null default 0,
  responsibility_malus numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- score_events: atomic changes to load / malus
create table if not exists score_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  kind text not null,
  delta_load numeric not null default 0,
  delta_malus numeric not null default 0,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now()
);

-- Ensure tasks has created_at and proof_required (already present in initial migration,
-- but keep here for idempotency in case of manual changes)
alter table tasks
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists proof_required boolean not null default true;

-- task_assignments for token-based task flows
create table if not exists task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  assigned_to_name text not null,
  token text not null unique,
  confirmed_name text,
  status text not null default 'offen',
  proof_url text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Extend shift_assignments to support verification flow
alter table shift_assignments
  add column if not exists assigned_to uuid references profiles(id),
  add column if not exists replacement_for uuid references profiles(id),
  add column if not exists replacement_to uuid references profiles(id),
  add column if not exists confirmed_at timestamptz,
  add column if not exists verified_by uuid references profiles(id),
  add column if not exists verified_at timestamptz;

-- cash_movements / cash_balance for treasury
create table if not exists cash_movements (
  id uuid primary key default gen_random_uuid(),
  uploaded_at timestamptz not null default now(),
  date date not null,
  description text not null,
  amount numeric not null,
  category text,
  uploaded_by uuid references profiles(id)
);

create table if not exists cash_balance (
  id uuid primary key default gen_random_uuid(),
  current_balance numeric not null,
  updated_at timestamptz not null default now(),
  source_movement_id uuid references cash_movements(id)
);

-- committee_activity aggregated per committee and date
create table if not exists committee_activity (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid references committees(id),
  date date not null,
  msg_count int not null default 0,
  tasks_created int not null default 0,
  tasks_verified int not null default 0,
  shifts_completed int not null default 0,
  score numeric not null default 0,
  created_at timestamptz not null default now()
);

