-- ============================================================================
-- engagement_events: Org-Mitglieder dürfen Events ihrer Organisation lesen
-- (Aktivitätsanzeige im Dashboard; bisher nur admin/lead)
-- ============================================================================

drop policy if exists "engagement_admin_read" on public.engagement_events;

create policy "engagement_admin_read"
on public.engagement_events
for select
using (
  public.is_super_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = engagement_events.user_id
      and p.organization_id = public.current_user_organization_id()
  )
);
