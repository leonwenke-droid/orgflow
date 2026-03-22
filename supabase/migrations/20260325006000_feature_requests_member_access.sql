-- Allow org members to read all feedback in their org and submit new requests.
-- Admins keep update via existing policies + is_org_admin.

drop policy if exists "feature_requests_read_member" on public.feature_requests;
create policy "feature_requests_read_member"
on public.feature_requests for select
using (
  organization_id in (
    select p.organization_id
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.status is distinct from 'disabled'
  )
);

drop policy if exists "feature_requests_insert_member" on public.feature_requests;
create policy "feature_requests_insert_member"
on public.feature_requests for insert
with check (
  organization_id in (
    select p.organization_id
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.status is distinct from 'disabled'
  )
);
