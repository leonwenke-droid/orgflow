-- Hot-path indexes (additive, safe for rollback via DROP INDEX)

create index if not exists idx_profiles_org_auth_user
  on public.profiles (organization_id, auth_user_id);

create index if not exists idx_tasks_org_status_due
  on public.tasks (organization_id, status, due_at);

create index if not exists idx_tasks_org_committee_status
  on public.tasks (organization_id, committee_id, status);

create index if not exists idx_shifts_org_date
  on public.shifts (organization_id, date);

create index if not exists idx_shift_assignments_shift_user
  on public.shift_assignments (shift_id, user_id);

create index if not exists idx_invite_links_org_token
  on public.invite_links (organization_id, token);

create index if not exists idx_task_transfer_requests_org_status
  on public.task_transfer_requests (organization_id, status, created_at);

create index if not exists idx_material_procurements_org_status_needed_by
  on public.material_procurements (organization_id, status, needed_by);

