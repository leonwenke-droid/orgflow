-- Multi-org: same auth user can have multiple profiles (one per organization).
-- current_user_organization_id() and current_profile_id() used LIMIT 1 → only one org worked.
-- Fix: user_accessible_organization_ids() for RLS; get_my_organization_id() only when exactly one membership.

-- ---------------------------------------------------------------------------
-- 1) All organization UUIDs the current user may access (canonical + TGG legacy data-plane id)
-- ---------------------------------------------------------------------------

create or replace function public.user_accessible_organization_ids()
returns uuid[]
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  ids uuid[];
begin
  set local row_security = off;
  select coalesce(array_agg(distinct x), array[]::uuid[])
  into ids
  from (
    select p.organization_id as x
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and coalesce(p.status, 'active') <> 'disabled'
    union
    select
      case
        when exists (
          select 1
          from public.organizations o
          where o.id = p.organization_id
            and o.slug in ('abi-2026-tgg', 'abi2026-tgg')
        ) then 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
        else p.organization_id
      end as x
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and coalesce(p.status, 'active') <> 'disabled'
  ) s;
  return ids;
end;
$$;

comment on function public.user_accessible_organization_ids() is
  'All organization UUIDs the session user can access (multi-org + TGG legacy id).';

grant execute on function public.user_accessible_organization_ids() to authenticated;
grant execute on function public.user_accessible_organization_ids() to anon;

-- ---------------------------------------------------------------------------
-- 2) Single-org helpers: NULL when user has more than one active membership
-- ---------------------------------------------------------------------------

create or replace function public.get_my_organization_id()
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_cnt int;
  v_org uuid;
begin
  set local row_security = off;
  select count(distinct p.organization_id)
  into v_cnt
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and coalesce(p.status, 'active') <> 'disabled';

  if v_cnt is null or v_cnt = 0 then
    return null;
  end if;
  if v_cnt > 1 then
    return null;
  end if;

  select p.organization_id
  into v_org
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and coalesce(p.status, 'active') <> 'disabled'
  limit 1;

  if v_org is null then
    return null;
  end if;

  if exists (
    select 1
    from public.organizations o
    where o.id = v_org
      and o.slug in ('abi-2026-tgg', 'abi2026-tgg')
  ) then
    return 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  end if;

  return v_org;
end;
$$;

create or replace function public.current_user_organization_id()
returns uuid
language sql
volatile
security definer
set search_path = public
as $$
  select public.get_my_organization_id();
$$;

-- Avoid "more than one row" when multiple profiles share one auth user.
create or replace function public.current_profile_role()
returns public.role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and coalesce(p.status, 'active') <> 'disabled'
  order by p.organization_id
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 3) Policies: replace single-org id check with ANY(user_accessible_organization_ids())
-- ---------------------------------------------------------------------------

drop policy if exists "organizations_read" on public.organizations;
create policy "organizations_read"
on public.organizations for select
using (
  (auth.role() in ('anon', 'authenticated') and is_active = true)
  or public.is_super_admin()
  or id = any (public.user_accessible_organization_ids())
);

drop policy if exists "profiles_select_org" on public.profiles;
create policy "profiles_select_org"
on public.profiles
for select
using (
  public.is_super_admin()
  or organization_id = any (public.user_accessible_organization_ids())
);

drop policy if exists "tasks_read" on public.tasks;
create policy "tasks_read"
on public.tasks for select
using (
  public.is_super_admin()
  or organization_id = any (public.user_accessible_organization_ids())
);

drop policy if exists "shifts_read" on public.shifts;
create policy "shifts_read"
on public.shifts for select
using (
  public.is_super_admin()
  or organization_id = any (public.user_accessible_organization_ids())
);

drop policy if exists "engagement_scores_read" on public.engagement_scores;
create policy "engagement_scores_read"
on public.engagement_scores for select
using (
  public.is_super_admin()
  or organization_id = any (public.user_accessible_organization_ids())
);

drop policy if exists "committees_read" on public.committees;
create policy "committees_read"
on public.committees for select
using (
  public.is_super_admin()
  or organization_id = any (public.user_accessible_organization_ids())
  or is_default = true
);

drop policy if exists "committees_insert_admin" on public.committees;
create policy "committees_insert_admin"
on public.committees for insert
with check (
  public.is_super_admin()
  or public.is_org_admin(organization_id)
);

drop policy if exists "finance_categories_read_org" on public.finance_categories;
create policy "finance_categories_read_org"
on public.finance_categories for select
using (
  public.is_super_admin()
  or organization_id = any (public.user_accessible_organization_ids())
);

drop policy if exists "resource_categories_read_org" on public.resource_categories;
create policy "resource_categories_read_org"
on public.resource_categories for select
using (
  public.is_super_admin()
  or organization_id = any (public.user_accessible_organization_ids())
);

drop policy if exists "resource_categories_write_admin" on public.resource_categories;
create policy "resource_categories_write_admin"
on public.resource_categories for all
using (
  public.is_super_admin()
  or public.is_org_admin(organization_id)
)
with check (
  public.is_super_admin()
  or public.is_org_admin(organization_id)
);

drop policy if exists "audit_logs_read_admin" on public.audit_logs;
create policy "audit_logs_read_admin"
on public.audit_logs for select
using (
  public.is_super_admin()
  or (
    organization_id = any (public.user_accessible_organization_ids())
    and public.is_org_admin(organization_id)
  )
);

drop policy if exists "events_read" on public.events;
create policy "events_read"
on public.events for select
using (
  organization_id = any (public.user_accessible_organization_ids())
  or public.is_super_admin()
);

drop policy if exists "feature_requests_read_admin" on public.feature_requests;
create policy "feature_requests_read_admin"
on public.feature_requests for select
using (
  public.is_super_admin()
  or public.is_org_admin(organization_id)
);

drop policy if exists "feature_requests_write_admin" on public.feature_requests;
create policy "feature_requests_write_admin"
on public.feature_requests for insert
with check (
  public.is_super_admin()
  or public.is_org_admin(organization_id)
);

drop policy if exists "feature_requests_update_admin" on public.feature_requests;
create policy "feature_requests_update_admin"
on public.feature_requests for update
using (
  public.is_super_admin()
  or public.is_org_admin(organization_id)
)
with check (
  public.is_super_admin()
  or public.is_org_admin(organization_id)
);

drop policy if exists "engagement_admin_read" on public.engagement_events;
create policy "engagement_admin_read"
on public.engagement_events for select
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.profiles p_subject
    where p_subject.id = engagement_events.user_id
      and coalesce(p_subject.status, 'active') <> 'disabled'
      and p_subject.organization_id = any (public.user_accessible_organization_ids())
  )
);

drop policy if exists "treasury_updates_read_restricted" on public.treasury_updates;
create policy "treasury_updates_read_restricted"
on public.treasury_updates for select
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.organization_id = treasury_updates.organization_id
      and p.status <> 'disabled'
      and p.role in ('admin', 'lead', 'owner', 'finance', 'super_admin')
  )
);

-- ---------------------------------------------------------------------------
-- 4) task_transfer_requests
-- ---------------------------------------------------------------------------

drop policy if exists "ttr_read_org_members" on public.task_transfer_requests;
create policy "ttr_read_org_members"
on public.task_transfer_requests for select
using (
  organization_id = any (public.user_accessible_organization_ids())
);

drop policy if exists "ttr_insert_authenticated" on public.task_transfer_requests;
create policy "ttr_insert_authenticated"
on public.task_transfer_requests for insert
with check (
  from_user_id in (
    select p.id from public.profiles p
    where p.auth_user_id = auth.uid()
      and coalesce(p.status, 'active') <> 'disabled'
  )
  or requested_by in (
    select p.id from public.profiles p
    where p.auth_user_id = auth.uid()
      and coalesce(p.status, 'active') <> 'disabled'
  )
);

drop policy if exists "ttr_update_admin_lead" on public.task_transfer_requests;
create policy "ttr_update_admin_lead"
on public.task_transfer_requests for update
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and coalesce(p.status, 'active') <> 'disabled'
      and p.organization_id = task_transfer_requests.organization_id
      and p.role in ('admin', 'lead', 'owner', 'super_admin')
  )
);

-- ---------------------------------------------------------------------------
-- 5) shift_assignments (member claim / unclaim / self read)
-- ---------------------------------------------------------------------------

drop policy if exists "shift_assignments_read_self_or_admin" on public.shift_assignments;
create policy "shift_assignments_read_self_or_admin"
on public.shift_assignments for select
using (
  user_id in (
    select p.id from public.profiles p
    where p.auth_user_id = auth.uid()
      and coalesce(p.status, 'active') <> 'disabled'
  )
  or exists (
    select 1
    from public.shifts s
    inner join public.profiles p on p.auth_user_id = auth.uid()
      and coalesce(p.status, 'active') <> 'disabled'
      and p.role in ('admin', 'lead', 'owner', 'super_admin')
    where s.id = shift_assignments.shift_id
      and (
        p.organization_id = s.organization_id
        or (
          s.organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
          and exists (
            select 1
            from public.organizations o
            where o.id = p.organization_id
              and o.slug in ('abi-2026-tgg', 'abi2026-tgg')
          )
        )
      )
  )
);

drop policy if exists "shift_assignments_member_claim" on public.shift_assignments;
create policy "shift_assignments_member_claim"
on public.shift_assignments for insert
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.profiles p
    inner join public.shifts s on s.id = shift_assignments.shift_id
    where p.id = shift_assignments.user_id
      and p.auth_user_id = auth.uid()
      and coalesce(p.status, 'active') <> 'disabled'
      and (
        p.organization_id = s.organization_id
        or (
          s.organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
          and exists (
            select 1
            from public.organizations o
            where o.id = p.organization_id
              and o.slug in ('abi-2026-tgg', 'abi2026-tgg')
          )
        )
      )
      and s.organization_id = any (public.user_accessible_organization_ids())
  )
);

drop policy if exists "shift_assignments_member_unclaim" on public.shift_assignments;
create policy "shift_assignments_member_unclaim"
on public.shift_assignments for delete
using (
  user_id in (
    select p.id from public.profiles p
    where p.auth_user_id = auth.uid()
      and coalesce(p.status, 'active') <> 'disabled'
  )
);

-- ---------------------------------------------------------------------------
-- 6) rotation_scores + member_unavailability
-- ---------------------------------------------------------------------------

drop policy if exists rotation_scores_select_org on public.rotation_scores;
create policy rotation_scores_select_org
on public.rotation_scores for select
using (
  public.is_super_admin()
  or (
    organization_id = any (public.user_accessible_organization_ids())
    and (
      user_id in (
        select p.id from public.profiles p
        where p.auth_user_id = auth.uid()
          and coalesce(p.status, 'active') <> 'disabled'
      )
      or public.is_org_admin(organization_id)
    )
  )
);

drop policy if exists member_unavailability_select on public.member_unavailability;
create policy member_unavailability_select
on public.member_unavailability for select
using (
  public.is_super_admin()
  or (
    organization_id = any (public.user_accessible_organization_ids())
    and (
      user_id in (
        select p.id from public.profiles p
        where p.auth_user_id = auth.uid()
          and coalesce(p.status, 'active') <> 'disabled'
      )
      or public.is_org_admin(organization_id)
    )
  )
);

drop policy if exists member_unavailability_insert on public.member_unavailability;
create policy member_unavailability_insert
on public.member_unavailability for insert
with check (
  public.is_super_admin()
  or (
    organization_id = any (public.user_accessible_organization_ids())
    and (
      user_id in (
        select p.id from public.profiles p
        where p.auth_user_id = auth.uid()
          and coalesce(p.status, 'active') <> 'disabled'
      )
      or public.is_org_admin(organization_id)
    )
  )
);

drop policy if exists member_unavailability_update on public.member_unavailability;
create policy member_unavailability_update
on public.member_unavailability for update
using (
  public.is_super_admin()
  or (
    organization_id = any (public.user_accessible_organization_ids())
    and (
      user_id in (
        select p.id from public.profiles p
        where p.auth_user_id = auth.uid()
          and coalesce(p.status, 'active') <> 'disabled'
      )
      or public.is_org_admin(organization_id)
    )
  )
);

drop policy if exists member_unavailability_delete on public.member_unavailability;
create policy member_unavailability_delete
on public.member_unavailability for delete
using (
  public.is_super_admin()
  or (
    organization_id = any (public.user_accessible_organization_ids())
    and (
      user_id in (
        select p.id from public.profiles p
        where p.auth_user_id = auth.uid()
          and coalesce(p.status, 'active') <> 'disabled'
      )
      or public.is_org_admin(organization_id)
    )
  )
);
