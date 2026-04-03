-- Fix: "stack depth limit exceeded" (54001) on SELECT from public.profiles.
-- Cause: a single profiles_read policy OR-combines is_super_admin() / current_user_organization_id()
-- with (auth_user_id = auth.uid()). Postgres may evaluate the heavy branches first; those
-- subquery profiles again → recursive RLS evaluation.
-- Fix: split into two PERMISSIVE SELECT policies. "Self" row matches without calling helpers.

drop policy if exists "profiles_read" on public.profiles;
-- Idempotent: re-run safe after a partial apply in the SQL editor.
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_select_org" on public.profiles;

create policy "profiles_select_self"
on public.profiles
for select
using (auth_user_id = auth.uid());

create policy "profiles_select_org"
on public.profiles
for select
using (
  public.is_super_admin()
  or organization_id = public.current_user_organization_id()
);
