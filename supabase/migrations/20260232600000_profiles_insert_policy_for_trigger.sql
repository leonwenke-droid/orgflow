-- ============================================================================
-- Trigger handle_new_user kann sonst nicht in public.profiles schreiben
-- ("Database error saving new user"). Zwei Ansätze:
-- 1) Funktion dem Tabellen-Owner (postgres) zuweisen → INSERT läuft als Owner, RLS-Bypass.
-- 2) GRANT + RLS-Policy für supabase_auth_admin falls Trigger in deren Kontext läuft.
-- ============================================================================

-- 1) SECURITY DEFINER läuft als Funktions-Owner; Owner = postgres → braucht INSERT auf Tabelle
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'postgres') then
    alter function public.handle_new_user() owner to postgres;
    grant insert on public.profiles to postgres;
  end if;
exception when others then
  null;
end $$;

grant usage on schema public to supabase_auth_admin;
grant insert on public.profiles to supabase_auth_admin;

drop policy if exists "profiles_insert_trigger" on public.profiles;
create policy "profiles_insert_trigger"
on public.profiles for insert
to supabase_auth_admin
with check (true);

-- Explizit für postgres (Trigger läuft mit SECURITY DEFINER als postgres)
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'postgres') then
    execute 'drop policy if exists profiles_insert_postgres on public.profiles';
    execute 'create policy profiles_insert_postgres on public.profiles for insert to postgres with check (true)';
  end if;
end $$;

drop policy if exists "profiles_insert_trigger_definer" on public.profiles;
create policy "profiles_insert_trigger_definer"
on public.profiles for insert
with check (auth_user_id is not null);
