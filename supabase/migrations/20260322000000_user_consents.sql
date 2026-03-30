-- Persist user consent decisions (GDPR basics)

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  consent_type text not null,
  consent_value boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_consents_auth_user_id on public.user_consents(auth_user_id);
create index if not exists idx_user_consents_type_created_at on public.user_consents(consent_type, created_at desc);

alter table public.user_consents enable row level security;

drop policy if exists "user_consents_select_own" on public.user_consents;
create policy "user_consents_select_own"
on public.user_consents for select
using (
  auth.uid() = auth_user_id
  or public.is_super_admin()
);

drop policy if exists "user_consents_insert_own" on public.user_consents;
create policy "user_consents_insert_own"
on public.user_consents for insert
with check (
  auth.uid() = auth_user_id
);


