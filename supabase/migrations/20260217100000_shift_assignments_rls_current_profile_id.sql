-- Schichten/Zuweisungen auch für neu angelegte User (Member) sichtbar.
-- user_id in shift_assignments ist profiles.id; auth.uid() ist auth.users.id.
-- Policy bisher: user_id = auth.uid() → trifft nie zu seit Umstellung auf auth_user_id.
-- Lösung: current_profile_id() und Policy auf user_id = current_profile_id() umstellen.

-- 1) Hilfsfunktion: Profil-ID des eingeloggten Users
create or replace function current_profile_id()
returns uuid
language sql
stable
as $$
  select p.id
  from profiles p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;

comment on function current_profile_id() is 'Profil-ID des aktuellen Auth-Users (null wenn kein Profil).';

-- 2) RLS shift_assignments: Member sehen eigene Zuweisungen (user_id = eigene Profil-ID)
drop policy if exists "shift_assignments_read_self_or_admin" on public.shift_assignments;
create policy "shift_assignments_read_self_or_admin"
on public.shift_assignments
for select
using (
  user_id = current_profile_id()
  or current_profile_role() in ('admin', 'lead')
);
