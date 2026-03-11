-- Dokumentation: Individuell vergebene Punkte (wann, wie viele, Begründung, Vergeber)
create table if not exists score_import_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  points int not null,
  reason text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_score_import_log_org on score_import_log(organization_id);
create index if not exists idx_score_import_log_created_at on score_import_log(created_at desc);

comment on table score_import_log is 'Protokoll: Individuell vergebene Punkte mit Begründung und Zeitstempel';

alter table score_import_log enable row level security;

create policy "score_import_log_org_admin_read"
on score_import_log for select
using (
  public.is_super_admin()
  or exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.organization_id = score_import_log.organization_id
      and p.role in ('admin', 'lead', 'super_admin')
  )
);

create policy "score_import_log_org_admin_insert"
on score_import_log for insert
with check (
  public.is_super_admin()
  or exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.organization_id = score_import_log.organization_id
      and p.role in ('admin', 'lead', 'super_admin')
  )
);
