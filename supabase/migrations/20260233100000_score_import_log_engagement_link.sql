-- Verknüpfung zu engagement_events für Entfernen/Rückgängig
alter table score_import_log
  add column if not exists engagement_event_id uuid references engagement_events(id) on delete set null;

create index if not exists idx_score_import_log_engagement_event on score_import_log(engagement_event_id) where engagement_event_id is not null;

comment on column score_import_log.engagement_event_id is 'Verknüpfung zum engagement_event; für Entfernen erforderlich';

-- Policy: Admins dürfen löschen
create policy "score_import_log_org_admin_delete"
on score_import_log for delete
using (
  public.is_super_admin()
  or exists (
    select 1 from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.organization_id = score_import_log.organization_id
      and p.role in ('admin', 'lead', 'super_admin')
  )
);
