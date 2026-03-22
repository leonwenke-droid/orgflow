-- In-app notifications (inserted by backend via service role; users read via RLS).

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_notifications_profile_unread
  on public.user_notifications(profile_id, created_at desc)
  where read_at is null;

create index if not exists idx_user_notifications_profile_created
  on public.user_notifications(profile_id, created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists "user_notifications_select_own" on public.user_notifications;
create policy "user_notifications_select_own"
on public.user_notifications for select
using (
  profile_id in (
    select p.id from public.profiles p where p.auth_user_id = auth.uid()
  )
);

drop policy if exists "user_notifications_update_own" on public.user_notifications;
create policy "user_notifications_update_own"
on public.user_notifications for update
using (
  profile_id in (
    select p.id from public.profiles p where p.auth_user_id = auth.uid()
  )
)
with check (
  profile_id in (
    select p.id from public.profiles p where p.auth_user_id = auth.uid()
  )
);

-- No insert policy for authenticated: inserts only via service role.

grant select, update on public.user_notifications to authenticated;
