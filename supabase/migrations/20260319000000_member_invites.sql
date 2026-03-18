-- Invite-only member onboarding:
-- profiles stores lifecycle state and hashed invite metadata.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists status text not null default 'active',
  add column if not exists invite_status text not null default 'accepted',
  add column if not exists invite_token_hash text,
  add column if not exists invite_expires_at timestamptz,
  add column if not exists invited_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists invited_by uuid references public.profiles(id) on delete set null;

update public.profiles
set status = coalesce(status, 'active'),
    invite_status = coalesce(invite_status, 'accepted')
where status is null or invite_status is null;

alter table public.profiles
  add constraint profiles_status_check
  check (status in ('invited', 'active', 'disabled'));

alter table public.profiles
  add constraint profiles_invite_status_check
  check (invite_status in ('pending', 'accepted', 'expired', 'revoked'));

create unique index if not exists idx_profiles_invite_token_hash
  on public.profiles(invite_token_hash)
  where invite_token_hash is not null;

create index if not exists idx_profiles_status on public.profiles(status);
create index if not exists idx_profiles_invite_status on public.profiles(invite_status);

create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from profiles
  where auth_user_id = auth.uid()
    and coalesce(status, 'active') <> 'disabled'
  limit 1;
$$;

create or replace function public.is_org_admin(org_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles
    where auth_user_id = auth.uid()
      and coalesce(status, 'active') <> 'disabled'
      and role in ('admin', 'owner', 'lead', 'super_admin')
      and (org_id is null or organization_id = org_id)
  );
$$;

create or replace function public.get_my_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where auth_user_id = auth.uid()
    and coalesce(status, 'active') <> 'disabled'
  limit 1;
$$;

