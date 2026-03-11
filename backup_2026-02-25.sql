--
-- PostgreSQL database dump
--

\restrict bWhy2bzRqXJgdxnYGPwaghXdbSBHU97rTi4Y0JR97i27zCQNnD5aB9INjwcEcYi

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.role AS ENUM (
    'admin',
    'lead',
    'member'
);


ALTER TYPE public.role OWNER TO postgres;

--
-- Name: shift_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.shift_status AS ENUM (
    'zugewiesen',
    'bestätigt',
    'getauscht',
    'abgesagt',
    'erledigt'
);


ALTER TYPE public.shift_status OWNER TO postgres;

--
-- Name: task_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.task_status AS ENUM (
    'offen',
    'in_arbeit',
    'erledigt'
);


ALTER TYPE public.task_status OWNER TO postgres;

--
-- Name: apply_task_missed_penalties(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.apply_task_missed_penalties() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into engagement_events (user_id, event_type, points, source_id)
  select t.owner_id, 'task_missed', -15, t.id
  from tasks t
  where t.owner_id is not null
    and t.status <> 'erledigt'
    and t.due_at is not null
    and t.due_at < now()
    and not exists (
      select 1 from engagement_events e
      where e.source_id = t.id and e.event_type = 'task_missed'
    );
end;
$$;


ALTER FUNCTION public.apply_task_missed_penalties() OWNER TO postgres;

--
-- Name: FUNCTION apply_task_missed_penalties(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.apply_task_missed_penalties() IS 'Legt für alle überfälligen, nicht erledigten Aufgaben einmalig -15 Punkte (task_missed) an. Wird beim Laden von Dashboard/Admin-Aufgaben aufgerufen.';


--
-- Name: check_financial_target(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_financial_target() RETURNS TABLE(ok boolean, total numeric, target_min numeric, target_max numeric, deadline date)
    LANGUAGE plpgsql
    AS $$
declare
  v_total numeric;
  v_deadline date := coalesce(
    nullif(current_setting('abi_orga.financial_deadline', true), '')::date,
    date '2026-05-01'
  );
  v_min numeric := coalesce(
    nullif(current_setting('abi_orga.financial_target_min', true), '')::numeric,
    11000
  );
  v_max numeric := coalesce(
    nullif(current_setting('abi_orga.financial_target_max', true), '')::numeric,
    13000
  );
begin
  select coalesce(sum(amount), 0) into v_total from treasury_updates;
  return query
  select
    (current_date < v_deadline or v_total between v_min and v_max) as ok,
    v_total,
    v_min,
    v_max,
    v_deadline;
end;
$$;


ALTER FUNCTION public.check_financial_target() OWNER TO postgres;

--
-- Name: current_profile_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_profile_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select p.id
  from profiles p
  where p.auth_user_id = auth.uid()
  limit 1;
$$;


ALTER FUNCTION public.current_profile_id() OWNER TO postgres;

--
-- Name: FUNCTION current_profile_id(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.current_profile_id() IS 'Profil-ID des aktuellen Auth-Users (null wenn kein Profil).';


--
-- Name: current_profile_role(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.current_profile_role() RETURNS public.role
    LANGUAGE sql STABLE
    AS $$
  select p.role
  from profiles p
  where p.auth_user_id = auth.uid();
$$;


ALTER FUNCTION public.current_profile_role() OWNER TO postgres;

--
-- Name: ensure_user_counters_on_profile_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ensure_user_counters_on_profile_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into user_counters (user_id, load_index, responsibility_malus, updated_at)
  values (new.id, 0, 0, now())
  on conflict (user_id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION public.ensure_user_counters_on_profile_insert() OWNER TO postgres;

--
-- Name: get_engagement_scores(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_engagement_scores() RETURNS TABLE(user_id uuid, score integer)
    LANGUAGE sql
    AS $$
  select user_id, score from engagement_scores;
$$;


ALTER FUNCTION public.get_engagement_scores() OWNER TO postgres;

--
-- Name: grant_lead_weekly_bonus(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.grant_lead_weekly_bonus() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  week_start date;
  lead_ids uuid[];
  already uuid[];
  to_grant uuid[];
  n int := 0;
begin
  -- Montag 00:00 der aktuellen ISO-Woche
  week_start := date_trunc('week', now()::timestamptz)::date;

  -- Alle Lead-IDs
  select array_agg(id) into lead_ids
  from profiles where role = 'lead';

  if lead_ids is null or array_length(lead_ids, 1) is null then
    return 0;
  end if;

  -- Wer hat diese Woche schon lead_weekly bekommen?
  select array_agg(distinct user_id) into already
  from engagement_events
  where event_type = 'lead_weekly'
    and created_at >= week_start::timestamptz;

  -- Nur wer noch nicht
  select array_agg(l) into to_grant
  from unnest(lead_ids) l
  where l is not null
    and (already is null or not (l = any(already)));

  if to_grant is not null and array_length(to_grant, 1) > 0 then
    insert into engagement_events (user_id, event_type, points)
    select unnest(to_grant), 'lead_weekly', 5;
    get diagnostics n = row_count;
  end if;

  return n;
end;
$$;


ALTER FUNCTION public.grant_lead_weekly_bonus() OWNER TO postgres;

--
-- Name: FUNCTION grant_lead_weekly_bonus(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.grant_lead_weekly_bonus() IS 'Fügt lead_weekly (+5 Punkte) für alle Leads hinzu, die diese Woche noch keinen haben. Idempotent.';


--
-- Name: handle_engagement_events_sync(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_engagement_events_sync() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if (tg_op = 'INSERT') then
    perform refresh_engagement_score(new.user_id);
  elsif (tg_op = 'UPDATE') then
    if old.user_id is distinct from new.user_id then
      perform refresh_engagement_score(old.user_id);
    end if;
    perform refresh_engagement_score(new.user_id);
  elsif (tg_op = 'DELETE') then
    perform refresh_engagement_score(old.user_id);
  end if;
  return null;
end;
$$;


ALTER FUNCTION public.handle_engagement_events_sync() OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  profile_id uuid;
begin
  if new.email is not null then
    select id into profile_id
    from public.profiles
    where email = new.email and auth_user_id is null
    limit 1;
    if profile_id is not null then
      update public.profiles set auth_user_id = new.id where id = profile_id;
      return new;
    end if;
  end if;
  insert into public.profiles (id, full_name, role, auth_user_id)
  values (
    gen_random_uuid(),
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1), 'Unbenannt'),
    'member',
    new.id
  );
  return new;
end;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: handle_shift_engagement(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_shift_engagement() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if (tg_op = 'UPDATE') then
    if new.status = 'erledigt' and (old.status is distinct from new.status) then
      insert into engagement_events (user_id, event_type, points, source_id)
      values (new.user_id, 'shift_done', 10, new.id);
    end if;
    -- abgesagt: keine Einträge hier, App fügt replacement_arranged/shift_done/shift_missed ein
  end if;
  return new;
end;
$$;


ALTER FUNCTION public.handle_shift_engagement() OWNER TO postgres;

--
-- Name: handle_shift_score_events(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_shift_score_events() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (tg_op = 'UPDATE') then
    delete from score_events where source_type = 'shift_assignment' and source_id = new.id;
    if new.status = 'erledigt' and (old.status is distinct from new.status) then
      insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
      values (new.user_id, 'shift_done', 1, 0, 'shift_assignment', new.id);
    elsif new.status = 'abgesagt' and (old.status is distinct from new.status) then
      if new.replacement_user_id is not null then
        insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
        values (new.user_id, 'replacement_organized', 0.5, 0, 'shift_assignment', new.id);
        insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
        values (new.replacement_user_id, 'shift_done', 1, 0, 'shift_assignment', new.id);
      else
        insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
        values (new.user_id, 'shift_missed', 2, 2, 'shift_assignment', new.id);
      end if;
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION public.handle_shift_score_events() OWNER TO postgres;

--
-- Name: handle_task_engagement(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_task_engagement() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  base_points int := 8;
begin
  if (tg_op = 'UPDATE') then
    if new.status = 'erledigt' and (old.status is distinct from new.status) then
      if new.owner_id is not null
        and exists (select 1 from profiles p where p.id = new.owner_id)
        and not exists (
          select 1 from engagement_events e
          where e.source_id = new.id and e.event_type = 'task_done' and e.user_id = new.owner_id
        ) then
        insert into engagement_events (user_id, event_type, points, source_id)
        values (new.owner_id, 'task_done', base_points, new.id);

        if new.due_at is not null and new.due_at < now() and not exists (
          select 1 from engagement_events e
          where e.source_id = new.id and e.event_type = 'task_late' and e.user_id = new.owner_id
        ) then
          insert into engagement_events (user_id, event_type, points, source_id)
          values (new.owner_id, 'task_late', -3, new.id);
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION public.handle_task_engagement() OWNER TO postgres;

--
-- Name: handle_task_score_events(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_task_score_events() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (tg_op = 'UPDATE') then
    if new.status = 'erledigt' and (old.status is distinct from new.status)
       and new.owner_id is not null
       and exists (select 1 from profiles p where p.id = new.owner_id) then
      insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
      values (new.owner_id, 'task_verified', 1, 0, 'task', new.id);
      if new.due_at is not null and new.due_at < now() then
        insert into score_events (user_id, kind, delta_load, delta_malus, source_type, source_id)
        values (new.owner_id, 'task_late', 0, 1, 'task', new.id);
      end if;
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION public.handle_task_score_events() OWNER TO postgres;

--
-- Name: recompute_committee_stats(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.recompute_committee_stats(p_committee_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_open int;
  v_in_progress int;
  v_completed int;
  v_overdue int;
  v_total int;
  v_score float;
begin
  select
    count(*) filter (where status = 'offen'),
    count(*) filter (where status = 'in_arbeit'),
    count(*) filter (where status = 'erledigt'),
    count(*) filter (where status <> 'erledigt' and due_at is not null and due_at < now())
  into v_open, v_in_progress, v_completed, v_overdue
  from tasks
  where committee_id = p_committee_id;

  v_total := coalesce(v_open,0) + coalesce(v_in_progress,0) + coalesce(v_completed,0) + coalesce(v_overdue,0);
  if v_total > 0 then
    v_score := coalesce(v_completed,0)::float / v_total::float * 100.0;
  else
    v_score := 0;
  end if;

  insert into committee_stats (committee_id, open_tasks, in_progress_tasks, completed_tasks, overdue_tasks, performance_score, updated_at)
  values (p_committee_id, coalesce(v_open,0), coalesce(v_in_progress,0), coalesce(v_completed,0), coalesce(v_overdue,0), v_score, now())
  on conflict (committee_id) do update
    set open_tasks = excluded.open_tasks,
        in_progress_tasks = excluded.in_progress_tasks,
        completed_tasks = excluded.completed_tasks,
        overdue_tasks = excluded.overdue_tasks,
        performance_score = excluded.performance_score,
        updated_at = excluded.updated_at;
end;
$$;


ALTER FUNCTION public.recompute_committee_stats(p_committee_id uuid) OWNER TO postgres;

--
-- Name: refresh_engagement_score(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.refresh_engagement_score(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into engagement_scores (user_id, score, updated_at)
  select p_user_id, coalesce(sum(points), 0), now()
  from engagement_events
  where user_id = p_user_id
  on conflict (user_id) do update
  set score = excluded.score, updated_at = excluded.updated_at;
end;
$$;


ALTER FUNCTION public.refresh_engagement_score(p_user_id uuid) OWNER TO postgres;

--
-- Name: set_tasks_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_tasks_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.set_tasks_updated_at() OWNER TO postgres;

--
-- Name: sync_auth_ban_with_profile_role(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_auth_ban_with_profile_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
begin
  if (tg_op = 'INSERT') then
    if new.role = 'member' then
      update auth.users set banned_until = '9999-12-31 23:59:59+00'::timestamptz where id = new.id;
    else
      update auth.users set banned_until = null where id = new.id;
    end if;
  elsif (tg_op = 'UPDATE') then
    if old.role is distinct from new.role then
      if new.role = 'member' then
        update auth.users set banned_until = '9999-12-31 23:59:59+00'::timestamptz where id = new.id;
      else
        update auth.users set banned_until = null where id = new.id;
      end if;
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION public.sync_auth_ban_with_profile_role() OWNER TO postgres;

--
-- Name: FUNCTION sync_auth_ban_with_profile_role(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.sync_auth_ban_with_profile_role() IS 'Sperrt Auth-Login für role=member, erlaubt für admin/lead.';


--
-- Name: sync_user_counters_from_score_event(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_user_counters_from_score_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into user_counters (user_id, load_index, responsibility_malus, updated_at)
  values (
    new.user_id,
    coalesce(new.delta_load, 0),
    coalesce(new.delta_malus, 0),
    now()
  )
  on conflict (user_id) do update set
    load_index = user_counters.load_index + coalesce(new.delta_load, 0),
    responsibility_malus = user_counters.responsibility_malus + coalesce(new.delta_malus, 0),
    updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.sync_user_counters_from_score_event() OWNER TO postgres;

--
-- Name: sync_user_counters_on_score_event_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_user_counters_on_score_event_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update user_counters
  set load_index = greatest(0, load_index - coalesce(old.delta_load, 0)),
      responsibility_malus = greatest(0, responsibility_malus - coalesce(old.delta_malus, 0)),
      updated_at = now()
  where user_id = old.user_id;
  return old;
end;
$$;


ALTER FUNCTION public.sync_user_counters_on_score_event_delete() OWNER TO postgres;

--
-- Name: trg_recompute_committee_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_recompute_committee_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if (tg_op = 'INSERT') then
    if new.committee_id is not null then
      perform recompute_committee_stats(new.committee_id);
    end if;
  elsif (tg_op = 'UPDATE') then
    if old.committee_id is not null then
      perform recompute_committee_stats(old.committee_id);
    end if;
    if new.committee_id is not null then
      perform recompute_committee_stats(new.committee_id);
    end if;
  elsif (tg_op = 'DELETE') then
    if old.committee_id is not null then
      perform recompute_committee_stats(old.committee_id);
    end if;
  end if;
  return null;
end;
$$;


ALTER FUNCTION public.trg_recompute_committee_stats() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: committee_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.committee_stats (
    committee_id uuid NOT NULL,
    open_tasks integer DEFAULT 0,
    in_progress_tasks integer DEFAULT 0,
    completed_tasks integer DEFAULT 0,
    overdue_tasks integer DEFAULT 0,
    performance_score double precision DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.committee_stats OWNER TO postgres;

--
-- Name: committees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.committees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.committees OWNER TO postgres;

--
-- Name: engagement_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.engagement_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event_type text,
    points integer NOT NULL,
    source_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT engagement_events_event_type_check CHECK ((event_type = ANY (ARRAY['task_done'::text, 'shift_done'::text, 'sponsoring_success'::text, 'lead_weekly'::text, 'task_late'::text, 'shift_missed'::text, 'task_missed'::text, 'score_import'::text, 'replacement_arranged'::text, 'material_small'::text, 'material_medium'::text, 'material_large'::text])))
);


ALTER TABLE public.engagement_events OWNER TO postgres;

--
-- Name: engagement_scores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.engagement_scores (
    user_id uuid NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.engagement_scores OWNER TO postgres;

--
-- Name: TABLE engagement_scores; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.engagement_scores IS 'Aggregierte Engagement-Punkte pro User, gepflegt per Trigger aus engagement_events';


--
-- Name: material_procurement_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.material_procurement_participants (
    material_id uuid NOT NULL,
    user_id uuid NOT NULL
);


ALTER TABLE public.material_procurement_participants OWNER TO postgres;

--
-- Name: TABLE material_procurement_participants; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.material_procurement_participants IS 'Pro Materialbeschaffung können mehrere Personen erfasst werden; jede erhält die Punkte.';


--
-- Name: material_procurements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.material_procurements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event_name text NOT NULL,
    item_description text NOT NULL,
    size text NOT NULL,
    proof_url text,
    verified_by uuid,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT material_procurements_size_check CHECK ((size = ANY (ARRAY['small'::text, 'medium'::text, 'large'::text])))
);


ALTER TABLE public.material_procurements OWNER TO postgres;

--
-- Name: TABLE material_procurements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.material_procurements IS 'Erfasste Materialbeschaffungen; fließen via engagement_events in den Engagement-Score.';


--
-- Name: profile_committees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profile_committees (
    user_id uuid NOT NULL,
    committee_id uuid NOT NULL
);


ALTER TABLE public.profile_committees OWNER TO postgres;

--
-- Name: TABLE profile_committees; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.profile_committees IS 'Alle Komitee-Zugehörigkeiten pro Person (Ergänzung zu profiles.committee_id = primäres Komitee).';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    role public.role DEFAULT 'member'::public.role NOT NULL,
    committee_id uuid,
    auth_user_id uuid,
    email text
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: COLUMN profiles.auth_user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.auth_user_id IS 'Verknüpfter Auth-User (Login). Null = kein Login.';


--
-- Name: COLUMN profiles.email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.profiles.email IS 'E-Mail; bei Einladung wird das Profil mit diesem Auth-User verknüpft.';


--
-- Name: score_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.score_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    delta_load numeric DEFAULT 0 NOT NULL,
    delta_malus numeric DEFAULT 0 NOT NULL,
    source_type text,
    source_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.score_events OWNER TO postgres;

--
-- Name: shift_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shift_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shift_id uuid,
    user_id uuid,
    status public.shift_status DEFAULT 'zugewiesen'::public.shift_status,
    replacement_user_id uuid,
    proof_url text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.shift_assignments OWNER TO postgres;

--
-- Name: shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_name text NOT NULL,
    date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    location text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    required_slots integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.shifts OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    committee_id uuid,
    owner_id uuid,
    due_at timestamp with time zone,
    status public.task_status DEFAULT 'offen'::public.task_status,
    proof_required boolean DEFAULT true,
    proof_url text,
    access_token text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    CONSTRAINT tasks_proof_check CHECK ((NOT ((proof_required = true) AND (status = 'erledigt'::public.task_status) AND (proof_url IS NULL))))
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: COLUMN tasks.created_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tasks.created_by IS 'User (profile) who created/issued the task';


--
-- Name: treasury_updates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.treasury_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    amount numeric NOT NULL,
    source text DEFAULT 'Excel Upload'::text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.treasury_updates OWNER TO postgres;

--
-- Name: user_counters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_counters (
    user_id uuid NOT NULL,
    load_index numeric DEFAULT 0 NOT NULL,
    responsibility_malus numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_counters OWNER TO postgres;

--
-- Data for Name: committee_stats; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.committee_stats (committee_id, open_tasks, in_progress_tasks, completed_tasks, overdue_tasks, performance_score, updated_at) FROM stdin;
7db1a51d-a706-465b-85e1-3f1fa797af79	0	0	0	0	0	2026-02-17 17:13:14.541238+00
5d2aff9a-ed88-4bae-be9b-3e43d939608a	0	0	0	0	0	2026-02-17 17:44:50.574186+00
\.


--
-- Data for Name: committees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.committees (id, name) FROM stdin;
2eeded59-adf9-40a6-adee-652af2883805	Veranstaltungskomitee
3ab92487-5995-4bb7-82c2-85a2e67eccd5	Abibuch
5f127eaf-2d18-48ed-a03c-cb71e66181c1	Mottowoche
40f958ef-028c-44eb-9752-516eb7f549fb	Abistreich
bced722a-7c28-4374-a7bc-7c185bbd7916	Socialmedia
7db1a51d-a706-465b-85e1-3f1fa797af79	Finanzkomitee
5d2aff9a-ed88-4bae-be9b-3e43d939608a	Abiball
72d82b43-e80a-496d-b100-a97de18f3aa5	Fußballturnier
\.


--
-- Data for Name: engagement_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.engagement_events (id, user_id, event_type, points, source_id, created_at) FROM stdin;
c030b442-06bc-4777-9cff-876d66d1251b	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	material_small	5	9a29a8a1-9a47-40a7-8935-24f2751b6eb0	2026-02-21 16:11:07.193897+00
1921abef-1a24-4c8c-a9e6-0f47f11186a4	fd148e93-0793-4394-a1a9-7782d6002404	score_import	17	\N	2026-02-17 17:14:23.166034+00
31d13a12-04c3-46c2-bc63-5629cc76a9f3	38e8b432-d0f4-4b2e-9da8-6838c34f80d2	score_import	2	\N	2026-02-17 17:14:23.572212+00
0d33718a-fba9-4eb4-bd3d-66ec8e25dceb	253b11de-a5ee-4852-87a9-99af7f2bc3f4	score_import	83	\N	2026-02-17 17:14:23.944857+00
762888d4-8f45-4db1-82ee-c4c2c39569c3	f81f5db4-5891-4092-9ee4-107c5ecaf8ae	score_import	37	\N	2026-02-17 17:14:24.319044+00
23c43c82-2d5e-4263-aa17-0a4f223de6d2	3ded5547-53e8-4e54-9344-8cce4dc14002	score_import	52	\N	2026-02-17 17:14:24.99061+00
61cb5554-21da-4b2a-8d01-3bd59e20847a	2bb4b8b0-a78b-4d63-b1ce-592bef579fd4	score_import	12	\N	2026-02-17 17:14:25.344721+00
1dfe80c0-aece-4559-9bd2-ad2cd0dd6472	7416ecdf-8e2f-4ba1-b4dc-bce1732d465c	score_import	43	\N	2026-02-17 17:14:25.707932+00
f639f9cf-d56c-42da-b7df-49b1e1ae2a9e	a1895e74-3246-4fe7-9fdc-92c2948aaeff	score_import	29	\N	2026-02-17 17:14:26.335843+00
60f40da8-d61d-4870-a7ff-513377e68947	1365befb-d2a2-4bc0-921a-b15653ee9843	score_import	28	\N	2026-02-17 17:14:26.694156+00
aa261c9c-e6e9-4690-ad71-f9bb863e165d	6049cadd-55d3-404d-9cd2-f2459cf11025	score_import	3	\N	2026-02-17 17:14:27.091949+00
32cb0264-787e-4775-b380-4b152e788b7b	8c458cd0-6f10-4a1b-946b-7900c9f8809a	score_import	46	\N	2026-02-17 17:14:27.637809+00
72c83912-1f83-4f7b-a410-44c1d1e775b1	0b9c1fdb-76c4-4498-91d7-94336e012d88	score_import	25	\N	2026-02-17 17:14:27.962384+00
718f1ccb-d2b9-4753-b6a6-49fd99a360c7	df8dbdbe-bf23-4f19-b168-f5eed5fb2166	score_import	5	\N	2026-02-17 17:14:28.339105+00
dd1303eb-1afd-4b5e-b71e-ef6327b0274b	0fbd2c0a-db10-4772-bfc7-6f20eec97256	score_import	13	\N	2026-02-17 17:14:35.101399+00
24a43ad3-1e11-4e53-b26e-1674c62b8350	21baacfe-5b7c-4e70-8671-bd3d8783661e	score_import	36	\N	2026-02-17 17:14:35.747636+00
dc445fe3-b95d-4e69-a386-5f7ceb820ad2	ee0cc14f-3426-4384-b32b-7a00169cf4d2	score_import	4	\N	2026-02-17 17:14:38.334679+00
0e8e4ea7-e4bf-4a81-b128-0b35b3e834bb	9086573c-3165-4ca1-98f5-0ee63d166a51	material_small	5	9a29a8a1-9a47-40a7-8935-24f2751b6eb0	2026-02-21 16:11:07.193897+00
c9a6cb23-14d3-4fc1-9bf5-39fbbac55162	447af2c6-92b5-4f03-b4b5-7daabe3c31c8	shift_missed	-15	87fd1124-f698-4473-ad13-71eadbb862ff	2026-02-20 23:12:41.913+00
4b3a2c86-b5e8-4c2e-a837-0d99df938895	8d3130a7-59f2-44d2-94c6-1d475c6d9206	material_small	5	9a29a8a1-9a47-40a7-8935-24f2751b6eb0	2026-02-21 16:11:07.193897+00
8ebde71f-8654-4b26-9678-63746b0da105	8c458cd0-6f10-4a1b-946b-7900c9f8809a	material_small	5	9a29a8a1-9a47-40a7-8935-24f2751b6eb0	2026-02-21 16:11:07.193897+00
115c2a07-19b1-4e60-bef0-76a59481768d	623d3518-9e98-4ed6-8f22-4b01643f2067	material_small	5	9a29a8a1-9a47-40a7-8935-24f2751b6eb0	2026-02-21 16:11:07.193897+00
8fca71ad-03c9-4719-be25-5853680e9323	907f8218-3086-4432-9574-1b6a390d215b	material_small	5	3e848bdc-8daa-4950-8a29-da3a92d95e22	2026-02-21 16:17:32.229678+00
c2c1d3e3-59c9-4bd0-b10a-3bc58d211fbe	fe64278a-c760-4945-bdc7-eb94d7e0bb79	shift_missed	-15	f058d06d-f1a4-40bf-a828-316f5f318d1c	2026-02-20 23:15:52.739586+00
5390ac25-c22b-44a6-b143-175a48ef11ef	907f8218-3086-4432-9574-1b6a390d215b	shift_done	10	fc1f4217-b0ee-4202-9131-3927a9ce289e	2026-02-22 13:57:53.295351+00
4194ca3d-9dd1-4c7a-8794-db4f2dcd9668	e0a3bb8d-2760-4b38-a876-63cd1df28bfb	material_small	5	9b7d8a6f-e98a-4a73-a15a-c3f4933d9753	2026-02-25 10:13:14.059476+00
eeecbe9a-e5cc-4f9c-b514-449704d09296	2bb4b8b0-a78b-4d63-b1ce-592bef579fd4	material_small	5	9b7d8a6f-e98a-4a73-a15a-c3f4933d9753	2026-02-25 10:13:14.059476+00
504187e9-1ffc-4ee5-940f-f71512dec0c0	ecdb1373-7081-4118-826d-93841fe544db	score_import	1	\N	2026-02-17 17:14:43.464151+00
91986948-5396-4407-a077-bddd5fd7bbc6	a711cdba-03a9-46e9-a894-f81a77c001ef	score_import	21	\N	2026-02-17 17:14:45.441598+00
70775a21-fd72-4ede-8225-5c4852071731	4eda936c-af7b-4c63-9f15-1e4bf99e235b	score_import	48	\N	2026-02-17 17:14:47.824315+00
7b24a5c2-7e4d-425c-82b0-fd161b891f35	95ee11d0-717c-484d-b1b5-280f728566e2	score_import	-3	\N	2026-02-17 17:14:48.206128+00
ce4a57d4-bd97-4347-930a-c614553cac12	57642b40-f142-4630-bab0-e798318d4d6b	score_import	-6	\N	2026-02-17 17:14:48.574648+00
6228706e-736f-480c-9ec4-f3d2f9fd7da7	d0315046-f60a-4f1a-a181-d8d6119b421a	score_import	-6	\N	2026-02-17 17:14:48.869324+00
046bcc50-1bf5-40b3-b490-8c27a97afdf3	fe64278a-c760-4945-bdc7-eb94d7e0bb79	score_import	-2	\N	2026-02-17 17:14:49.248925+00
4de91794-72f0-4a22-899c-f878530dbf7c	ebfc8bab-f7f1-408c-9906-33360ff16352	score_import	-6	\N	2026-02-17 17:14:49.850771+00
d9fcf0dc-e8e8-4a31-8a8b-79d08fe4425d	7416ecdf-8e2f-4ba1-b4dc-bce1732d465c	material_small	5	8a85fe7c-5042-4a45-be4c-27b97cf6bde1	2026-02-21 16:13:39.452546+00
060ff8a8-4323-4ee2-8db4-4b1c98c53f6c	74238ae3-a766-4d2b-94b7-d268634f34f9	material_small	5	8a85fe7c-5042-4a45-be4c-27b97cf6bde1	2026-02-21 16:13:39.452546+00
bc03db4e-e411-410b-b467-cf0442d11a5e	03cded49-8619-437e-a78f-7d3bfa86a5fb	score_import	-3	\N	2026-02-17 17:14:28.66581+00
19eaadee-a09b-40f2-9f3a-0061489f7ff7	45d8f8ee-0b52-4d2c-a068-cda116b0e586	score_import	4	\N	2026-02-17 17:14:29.197901+00
2ed2bf5b-adbe-40bb-8294-bf5841aebb85	d7f098df-6e33-4a55-a531-24ac8759a34b	score_import	9	\N	2026-02-17 17:14:29.51737+00
7760ef1a-e032-4ecd-97a7-5cfd363ed7f1	fb617735-4e5d-4261-92d8-6636af4b1e98	score_import	21	\N	2026-02-17 17:14:36.095406+00
17df232c-3f82-4573-a49f-5cfe73e49c78	623d3518-9e98-4ed6-8f22-4b01643f2067	score_import	7	\N	2026-02-17 17:14:36.471046+00
bbfdb7df-b228-41a4-9fbf-a593212d4c67	aae21dd6-8a37-4a44-aa72-961c91ccc9bb	score_import	-2	\N	2026-02-17 17:14:38.631845+00
dcc77fd7-ac6c-458c-8ddf-0b7068eb4c5e	98b53fa0-2ca3-4001-8ad9-5180158ecd20	score_import	3	\N	2026-02-17 17:14:38.963889+00
b27f0a94-ab39-4044-adf2-edd14e23027e	907f8218-3086-4432-9574-1b6a390d215b	score_import	50	\N	2026-02-17 17:14:39.361955+00
f81e02f6-51a3-480c-9b1d-8f8153df42c3	e0a3bb8d-2760-4b38-a876-63cd1df28bfb	score_import	9	\N	2026-02-17 17:14:39.737638+00
63daa34c-c2f1-4582-8880-f1a5f82318c8	2a396c7c-6b41-4eec-a98b-4494061569c1	material_small	5	8a85fe7c-5042-4a45-be4c-27b97cf6bde1	2026-02-21 16:13:39.452546+00
6e58ea08-dcab-4b8f-8ea1-ca98ca14678d	f81f5db4-5891-4092-9ee4-107c5ecaf8ae	material_small	5	8a85fe7c-5042-4a45-be4c-27b97cf6bde1	2026-02-21 16:13:39.452546+00
b8208813-a675-46b2-be4b-d8ee867135f0	28b5b4a3-0664-42a9-930b-6d01267b0a22	material_small	5	31bd433a-8e4d-42ca-98a6-324e5e44b8b2	2026-02-21 16:20:46.990738+00
c51e7f90-7214-426d-9276-22e7eddb49a2	59398199-9c7a-4281-b572-a2a9fcd83b27	material_small	5	31bd433a-8e4d-42ca-98a6-324e5e44b8b2	2026-02-21 16:20:46.990738+00
0c5716e0-1f8a-463f-9d6b-1a2ba87d9d44	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	material_small	5	31bd433a-8e4d-42ca-98a6-324e5e44b8b2	2026-02-21 16:20:46.990738+00
862d8ae8-f090-4a22-b0d3-bbe2d8b6c086	ee0cc14f-3426-4384-b32b-7a00169cf4d2	material_small	5	31bd433a-8e4d-42ca-98a6-324e5e44b8b2	2026-02-21 16:20:46.990738+00
0dc34882-7a01-4f3b-95cb-964e9588c4c1	6049cadd-55d3-404d-9cd2-f2459cf11025	material_small	5	31bd433a-8e4d-42ca-98a6-324e5e44b8b2	2026-02-21 16:20:46.990738+00
0afed45b-3e99-4977-b2c6-b40a75434742	0151d2e9-3b89-46ef-b581-a2ea5c64e909	material_large	15	290d3cec-b163-4962-8d02-2f835fd279e2	2026-02-22 14:03:21.671628+00
2a49f844-e169-4a43-9282-7ee8f9ccda7f	74238ae3-a766-4d2b-94b7-d268634f34f9	material_large	15	290d3cec-b163-4962-8d02-2f835fd279e2	2026-02-22 14:03:21.671628+00
d46974b7-9f65-4e12-b201-5df1a2d925e8	a9438f32-a5ac-4b94-a095-d06b6868e175	material_medium	10	bd34debe-23bd-421a-bbe2-5ee85f614e66	2026-02-25 10:48:02.608568+00
61f80308-0df6-406d-bb67-43e5996e2e32	0100e980-5d63-4dde-bdd1-49a049bef21e	score_import	1	\N	2026-02-17 17:14:43.962415+00
ccaf048b-ae12-49af-a0d3-b83fb2b0ee6b	f840c063-79b6-4796-ab93-0352c789621b	score_import	-7	\N	2026-02-17 17:14:45.710467+00
925e1332-e291-4efe-aecc-e3e3ef253ba9	23998be1-ab7f-47f2-bef7-a2827030578a	score_import	80	\N	2026-02-17 17:14:46.113045+00
8066bea9-0c1d-4ea5-95d9-ac74b99a1ffc	3793d0d4-c471-4b87-bf07-827e5a67a3c4	score_import	48	\N	2026-02-17 17:14:50.153463+00
365990b2-e75d-4c47-b4ff-275cbcc9a488	2acd81dc-9e33-4b30-97cf-9c822f8009e6	score_import	45	\N	2026-02-17 17:14:50.47426+00
c6c44878-bb20-4a98-8048-3a15c07eed55	165bad43-85d3-414c-954d-66df5a15139a	score_import	73	\N	2026-02-17 17:14:50.885969+00
e9d37b20-bdbb-486e-aa45-2016f1a5997d	d38bbea6-2e50-4df6-817f-ad5d86848f85	score_import	8	\N	2026-02-17 17:14:51.267908+00
b196ef96-698e-4e45-98c0-e2571c0648ed	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	material_medium	10	f2518691-7736-4a50-9c78-274fbe6c382a	2026-02-21 16:15:01.486908+00
4982e76f-9b20-4f14-890d-75693d71fb6a	a711cdba-03a9-46e9-a894-f81a77c001ef	material_medium	10	f2518691-7736-4a50-9c78-274fbe6c382a	2026-02-21 16:15:01.486908+00
b2b99520-1ac2-4dde-a3ee-6352ce635c15	5be1e6da-ed38-43be-8077-8aea7ab9ef6a	score_import	24	\N	2026-02-17 17:14:29.858944+00
b3d4f61c-297c-4531-94ae-b6dbf6c769a0	e9c2aaeb-a7f2-4325-bb27-16c684057330	score_import	-3	\N	2026-02-17 17:14:30.251416+00
efa65011-136b-4bd9-ae64-b2f4532b82e7	447af2c6-92b5-4f03-b4b5-7daabe3c31c8	score_import	-3	\N	2026-02-17 17:14:30.813277+00
5d2c47ee-f404-4c03-8a46-512033bcacc0	2a396c7c-6b41-4eec-a98b-4494061569c1	score_import	46	\N	2026-02-17 17:14:36.748787+00
da77cf37-2ba7-4014-8491-cd5604d0adbd	74238ae3-a766-4d2b-94b7-d268634f34f9	score_import	87	\N	2026-02-17 17:14:40.012113+00
6128e561-3e7d-498d-8b46-961dceb199cc	0151d2e9-3b89-46ef-b581-a2ea5c64e909	score_import	86	\N	2026-02-17 17:14:40.380747+00
fca789d5-7955-4760-9e0b-24bf62064664	6566d05b-38ca-4cbf-b357-e3f2dd49effc	score_import	8	\N	2026-02-17 17:14:40.909887+00
84418413-de10-4f9c-8dc8-abf9fd7b82c0	a41d6ab1-9025-4181-bec7-e707d794420c	score_import	1	\N	2026-02-17 17:14:44.203161+00
03108f09-7fa5-47fe-ae69-a0e29da86b21	08b67870-12bd-46be-8a3c-8d08c248636a	score_import	80	\N	2026-02-17 17:14:46.431522+00
be6e857b-d1d6-4e45-99ec-006ce7e640cb	03d616e1-41ca-4f77-b563-ed718288e7ef	score_import	1	\N	2026-02-17 17:14:47.03915+00
4211ca4e-52e2-407e-8b74-76ff3a0b7176	9086573c-3165-4ca1-98f5-0ee63d166a51	score_import	24	\N	2026-02-17 17:14:51.66825+00
57d276be-0e75-4848-b17f-010f88088174	21baacfe-5b7c-4e70-8671-bd3d8783661e	material_medium	10	f2518691-7736-4a50-9c78-274fbe6c382a	2026-02-21 16:15:01.486908+00
cf5ba4f7-12d9-4a79-bdd5-366474a8ea75	6566d05b-38ca-4cbf-b357-e3f2dd49effc	material_medium	10	f2518691-7736-4a50-9c78-274fbe6c382a	2026-02-21 16:15:01.486908+00
23fd9931-9c88-45bc-a55d-2a8771c07008	28b5b4a3-0664-42a9-930b-6d01267b0a22	material_medium	10	f2518691-7736-4a50-9c78-274fbe6c382a	2026-02-21 16:15:01.486908+00
ab5d7728-2839-483e-88ea-da9aa3d9ff28	907f8218-3086-4432-9574-1b6a390d215b	shift_done	10	60fde1e5-9b8d-40f0-9fa6-85035308dc20	2026-02-22 13:57:12.453344+00
e4fc4213-497c-4def-8152-c11ed5708f06	907f8218-3086-4432-9574-1b6a390d215b	material_large	15	d8e86168-283d-498f-870d-bcdc7e491386	2026-02-22 17:46:08.358686+00
2e7c682b-64d3-4abd-b02d-0fddf6c73f94	74238ae3-a766-4d2b-94b7-d268634f34f9	lead_weekly	5	\N	2026-02-21 15:34:44.408954+00
10cf0630-49b8-498f-a435-045fc87eeb1c	0151d2e9-3b89-46ef-b581-a2ea5c64e909	lead_weekly	5	\N	2026-02-21 15:34:44.408954+00
35244efa-1353-4f9a-8754-561d5a499e2c	70d84a7b-8609-44fd-aa06-e70bc186a8aa	lead_weekly	5	\N	2026-02-21 15:34:44.408954+00
2eab8321-579c-4fbc-afce-c0e3f36e6839	e6b3dc9b-b519-49b0-806f-c046db6bdae7	lead_weekly	5	\N	2026-02-21 15:34:44.408954+00
e48e7745-82ed-429c-944a-d7cb2b047817	08b67870-12bd-46be-8a3c-8d08c248636a	lead_weekly	5	\N	2026-02-21 15:34:44.408954+00
e6ee3c19-0ba7-4e27-ba92-3197b506372c	165bad43-85d3-414c-954d-66df5a15139a	lead_weekly	5	\N	2026-02-21 15:34:44.408954+00
70cbcf16-5149-43b1-9aea-02f200853e21	907f8218-3086-4432-9574-1b6a390d215b	lead_weekly	5	\N	2026-02-21 15:34:44.408954+00
5856946a-242c-4c63-bc69-c0ab98d5560c	f81f5db4-5891-4092-9ee4-107c5ecaf8ae	lead_weekly	5	\N	2026-02-21 15:34:44.408954+00
7ac78e25-62ad-4985-9378-64e4aeefbd11	3ded5547-53e8-4e54-9344-8cce4dc14002	lead_weekly	5	\N	2026-02-21 15:34:44.408954+00
4fc7e177-1717-4a31-a31a-0f5521f55100	a1895e74-3246-4fe7-9fdc-92c2948aaeff	material_small	5	67b0a391-8bf9-42b5-8a55-6fd68e6a70f7	2026-02-21 16:15:52.888293+00
c4289b24-f7b0-4e33-9c60-c1f1b871bb33	df8dbdbe-bf23-4f19-b168-f5eed5fb2166	material_small	5	67b0a391-8bf9-42b5-8a55-6fd68e6a70f7	2026-02-21 16:15:52.888293+00
45a56d21-7f87-46eb-84eb-a91fa8305f30	ae753655-975c-481b-af1e-32adfca31fd5	score_import	23	\N	2026-02-17 17:14:31.063067+00
7cc5ca9e-f8ce-463a-9255-2437057b71bb	2bde02ee-e6ab-4297-a3a0-f159709e470d	score_import	19	\N	2026-02-17 17:14:31.742487+00
4c3da030-eea7-48db-856b-3c409480f9d6	aa9b4464-9430-4d27-a8a0-24ca1fcca09c	score_import	51	\N	2026-02-17 17:14:32.331216+00
3f6c7dec-bb66-4ce6-b64b-3a80a300f161	28b5b4a3-0664-42a9-930b-6d01267b0a22	score_import	10	\N	2026-02-17 17:14:32.678576+00
43d38d5e-6ad6-4041-aafc-1d1d47267f22	26cca66b-02e0-430e-81b2-64b17f4b1167	score_import	-3	\N	2026-02-17 17:14:33.062748+00
23fff18f-984a-4000-b0fe-33222622813d	0451673c-60d8-4b08-8193-3adc46a549a8	score_import	3	\N	2026-02-17 17:14:33.442984+00
75105021-c12e-4193-a007-057eb55da253	5a0cce79-d26c-4e3f-ba5b-46021ac5b890	score_import	3	\N	2026-02-17 17:14:34.075577+00
78dca277-e125-4d49-b67c-baf87268f82f	477555a6-934a-48b1-801d-988da7a28da0	score_import	46	\N	2026-02-17 17:14:37.309816+00
0f0dca17-bfde-42d8-8651-dc7b2c56c1a5	70d84a7b-8609-44fd-aa06-e70bc186a8aa	score_import	53	\N	2026-02-17 17:14:41.252588+00
50396032-3184-4dbe-9955-5819f76a280f	896e664e-b5e5-435c-9ed7-bdc7ffa9c96c	score_import	2	\N	2026-02-17 17:14:41.566445+00
98475658-0a7e-41c3-b139-c0eb84b5c459	2afeb807-dc52-4d21-9870-d2d67aa4255c	score_import	15	\N	2026-02-17 17:14:44.544912+00
8f983227-d86f-493a-9682-fe32fa54cd0c	d4044703-c597-4577-ab1f-f0b12096a8d1	score_import	0	\N	2026-02-17 17:14:47.308273+00
5ce278b0-a807-45b3-ac9f-6dd5141ef365	3ded5547-53e8-4e54-9344-8cce4dc14002	material_small	5	67b0a391-8bf9-42b5-8a55-6fd68e6a70f7	2026-02-21 16:15:52.888293+00
6b28c199-c1ee-4b9b-9526-23947cbb4410	907f8218-3086-4432-9574-1b6a390d215b	shift_done	10	9c5050d4-e4d1-41b7-9869-5febed577876	2026-02-22 13:57:27.53294+00
ba93d984-77b2-4d28-9d31-2aaa46e56a0f	74238ae3-a766-4d2b-94b7-d268634f34f9	lead_weekly	5	\N	2026-02-23 06:00:00.22248+00
1b49afe0-b9c5-45eb-8a0a-f099653d2f3f	0151d2e9-3b89-46ef-b581-a2ea5c64e909	lead_weekly	5	\N	2026-02-23 06:00:00.22248+00
74d87997-f063-4c90-8512-5523f91f5d5a	70d84a7b-8609-44fd-aa06-e70bc186a8aa	lead_weekly	5	\N	2026-02-23 06:00:00.22248+00
00f3440f-a900-429b-b507-990df1b67739	e6b3dc9b-b519-49b0-806f-c046db6bdae7	lead_weekly	5	\N	2026-02-23 06:00:00.22248+00
e2f1702f-e9b5-4214-a904-10a688a452cd	08b67870-12bd-46be-8a3c-8d08c248636a	lead_weekly	5	\N	2026-02-23 06:00:00.22248+00
dd28044c-2738-43de-b271-91a48b81fb35	165bad43-85d3-414c-954d-66df5a15139a	lead_weekly	5	\N	2026-02-23 06:00:00.22248+00
7ba2406c-2d79-413c-90b9-64b7452e3587	907f8218-3086-4432-9574-1b6a390d215b	lead_weekly	5	\N	2026-02-23 06:00:00.22248+00
586ae104-f584-4e45-a198-6e6da79d1e63	6049cadd-55d3-404d-9cd2-f2459cf11025	shift_done	10	c75854f8-479f-4fbb-87f3-112e63264ebf	2026-02-21 15:42:49.883856+00
bc0fd8e6-78fc-43f9-9c9d-9253f3e19cab	4eda936c-af7b-4c63-9f15-1e4bf99e235b	shift_done	10	5edf0298-46d4-4457-9d57-318de42506cc	2026-02-21 15:42:49.883856+00
cd718fad-d105-47c8-b132-49a92820f3e0	4eda936c-af7b-4c63-9f15-1e4bf99e235b	shift_done	10	012c3f08-d822-4a3c-a021-acca67889eba	2026-02-21 15:42:49.883856+00
95756b67-73af-4831-9001-0e79d9b7f766	0451673c-60d8-4b08-8193-3adc46a549a8	shift_done	10	955905c5-4138-4c1b-b6ea-ef01f55263ee	2026-02-21 15:42:49.883856+00
9d04687a-7ff6-4c34-b215-82e120c97136	4eda936c-af7b-4c63-9f15-1e4bf99e235b	shift_done	10	2268961d-efc1-4053-855c-bbe81352ec92	2026-02-21 15:42:49.883856+00
334158fb-ed85-4f3c-8d99-df4805ddd63d	ee0cc14f-3426-4384-b32b-7a00169cf4d2	shift_done	10	2cebaa88-4a41-4243-92fb-a71826abdfa4	2026-02-21 15:42:49.883856+00
81a9662d-889c-4329-8773-fbbce49ce183	70d84a7b-8609-44fd-aa06-e70bc186a8aa	shift_done	10	b7054507-fb88-4d9f-ba85-e06c920ebbcf	2026-02-21 15:42:49.883856+00
2f07c188-1416-43bb-be2e-cf0a4a631406	a1895e74-3246-4fe7-9fdc-92c2948aaeff	shift_done	10	58c43167-79f4-484a-a195-10a2e65015c0	2026-02-21 15:42:49.883856+00
2ed66a03-e73e-4f57-b7a4-bdab9f87b461	45d8f8ee-0b52-4d2c-a068-cda116b0e586	shift_done	10	b283b4bc-5db4-4720-b724-6856c99113d2	2026-02-21 15:42:49.883856+00
bea5abd0-b884-4bb1-90f9-4c88ddf5c8b0	28b5b4a3-0664-42a9-930b-6d01267b0a22	shift_done	10	cdf2b8a9-6e85-4976-975e-d199793b66b9	2026-02-21 15:42:49.883856+00
d661d013-aae3-4e7b-a842-e34321916d10	a1895e74-3246-4fe7-9fdc-92c2948aaeff	shift_done	10	62c3e02f-1c3a-4a33-acc8-0d5e2d336b4c	2026-02-21 15:42:49.883856+00
696bf006-4c9b-4735-8ec3-f251e7d1c77e	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	shift_done	10	fe6b7ec2-ebfc-4290-b030-a0955f68c564	2026-02-21 15:42:49.883856+00
ee4e179b-e9b3-43ed-972f-b8ae13f32345	ae753655-975c-481b-af1e-32adfca31fd5	shift_done	10	d1e6441a-a058-42e6-80c6-0e1720d428af	2026-02-21 15:42:49.883856+00
df4a1313-abd9-4f87-a449-554416d78776	70d84a7b-8609-44fd-aa06-e70bc186a8aa	shift_done	10	c62e5519-f749-47b5-a55c-7d3de3799725	2026-02-21 15:42:49.883856+00
e9ac6e65-6045-4e9d-b8a6-689e4174b91e	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	shift_done	10	55dac618-837d-4698-8a7a-5b16634edc21	2026-02-21 15:42:49.883856+00
9bc0f5ae-8f94-41df-84f4-87849d32cc74	8d3130a7-59f2-44d2-94c6-1d475c6d9206	shift_done	10	cf4cbc68-101c-4ef8-9b43-d4e6e8afca94	2026-02-21 15:42:49.883856+00
7a56d8da-2971-4464-a66f-961bd2935003	8d3130a7-59f2-44d2-94c6-1d475c6d9206	shift_done	10	b2495732-db0d-4773-81dd-3d72cc5bb59c	2026-02-21 15:42:49.883856+00
773e6e65-8b9e-4987-9688-0bcc380a0b06	aae21dd6-8a37-4a44-aa72-961c91ccc9bb	shift_done	10	87c21942-c7e5-4e8e-bc65-2372fed38e0d	2026-02-21 15:42:49.883856+00
568fc842-8869-4981-9917-a72d2a5a8fcc	fd148e93-0793-4394-a1a9-7782d6002404	shift_done	10	131f7bc8-1148-4349-9355-54298e800831	2026-02-21 15:42:49.883856+00
73f06f9e-8ed8-4c9d-b166-ffd37acc5bc6	26cca66b-02e0-430e-81b2-64b17f4b1167	shift_done	10	0d6c9da0-8878-4cdf-b6b8-938f7dba1fb1	2026-02-21 15:42:49.883856+00
aeecdccb-f411-4b89-b574-0befcfed6754	a41d6ab1-9025-4181-bec7-e707d794420c	shift_done	10	1d4ae073-d453-4df3-a932-1e415082548a	2026-02-21 15:42:49.883856+00
7fa15dbd-fc69-4fd1-bc88-dfe846737b64	98b53fa0-2ca3-4001-8ad9-5180158ecd20	shift_done	10	e11a6750-4623-4936-b921-216d704b3f33	2026-02-21 15:42:49.883856+00
2d019c04-51c2-4582-8f7e-4e8777bfd7ca	70d84a7b-8609-44fd-aa06-e70bc186a8aa	shift_done	10	7d1616e5-1185-4347-b5b0-8322b375fe89	2026-02-21 15:42:49.883856+00
dfc8e43e-bd9e-4e38-9aa4-9e05476c2c3a	e9797fb7-1cf3-45f9-aeff-0ab875fbcb9e	shift_done	10	053dd476-0cbd-43ab-b125-4761fc55e526	2026-02-21 15:42:49.883856+00
4efdc39f-6c51-4ca8-b755-2f067e0223d8	7416ecdf-8e2f-4ba1-b4dc-bce1732d465c	shift_done	10	6c924a14-74bf-431e-8410-a5dce6a1f1a8	2026-02-21 15:42:49.883856+00
5923042f-d5b1-40b9-8894-526dfb897bef	9086573c-3165-4ca1-98f5-0ee63d166a51	shift_done	10	cc4e5644-1d59-4587-a8e6-6db7c21dc692	2026-02-21 15:42:49.883856+00
1e70117b-b0d0-4399-a360-7b74b4115d75	9086573c-3165-4ca1-98f5-0ee63d166a51	shift_done	10	49c0d716-8f10-4624-9008-31a75d4de219	2026-02-21 15:42:49.883856+00
eaa427db-174e-4302-b0e6-d187e6983797	21e2920a-e09c-4142-a3df-fe2ea1b14ba1	shift_done	10	236432b1-145e-47f7-9db5-958bcef394cb	2026-02-21 15:42:49.883856+00
679e1d9a-f09a-4158-978a-7a3abf62ac7f	df8dbdbe-bf23-4f19-b168-f5eed5fb2166	shift_done	10	827f4fd2-28be-4120-ba36-d9229865104d	2026-02-21 15:42:49.883856+00
1a650b30-4556-4acd-981a-9903c7a42dfc	57642b40-f142-4630-bab0-e798318d4d6b	shift_done	10	7b35046f-d286-4c5e-8c14-88dc66b76194	2026-02-21 15:42:49.883856+00
3edcb1f7-9b65-49b0-a2cc-4370ed29b42b	d4044703-c597-4577-ab1f-f0b12096a8d1	shift_done	10	081bd88d-e36b-4305-a39a-292e70503552	2026-02-21 15:42:49.883856+00
71a91712-6ce5-495c-adc4-3813a3ebedc5	ecdb1373-7081-4118-826d-93841fe544db	shift_done	10	e235af45-1bd3-4f4d-a2e8-d487451edde0	2026-02-21 15:42:49.883856+00
4ff3061d-951a-4437-94cc-717fbd19f856	59398199-9c7a-4281-b572-a2a9fcd83b27	shift_done	10	f0f63c32-356b-4555-a66a-cbdb1d6d8861	2026-02-21 15:42:49.883856+00
c8d68254-e075-4c4e-8f40-74036d843d5a	95ee11d0-717c-484d-b1b5-280f728566e2	shift_done	10	2ae51e1b-94e4-4d79-8cf8-ead58be18363	2026-02-21 15:42:49.883856+00
e0e8dae3-1236-4789-8886-25c7fafefadc	70d84a7b-8609-44fd-aa06-e70bc186a8aa	shift_done	10	62da48b8-6e5f-4cbf-b9f7-b9fe5e7c6d38	2026-02-21 15:42:49.883856+00
306b5bda-e534-4325-8a53-9de824f0d6d1	7416ecdf-8e2f-4ba1-b4dc-bce1732d465c	shift_done	10	639526b9-000b-4876-98be-33ddd0985a1f	2026-02-21 15:42:49.883856+00
70d3165a-2833-4d8a-b39c-1a6b8b4a73b5	e9797fb7-1cf3-45f9-aeff-0ab875fbcb9e	shift_done	10	58ea1783-f38a-4bcf-87e4-9681fce5f945	2026-02-21 15:42:49.883856+00
17026fd9-fa6c-4e98-a471-391b0031e5b2	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	shift_done	10	c1692f72-1b81-4cef-b142-b523ff042c50	2026-02-21 15:42:49.883856+00
373b98d9-f0bf-4c8c-ac48-ee98285ee5f3	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	shift_done	10	5d681b3d-f49f-4865-8b41-1099f9bde82a	2026-02-21 15:42:49.883856+00
707db815-fd9c-46c1-aa17-c4825944d8d8	4eda936c-af7b-4c63-9f15-1e4bf99e235b	shift_done	10	440c49b5-9b0e-4f47-9409-09835eea284e	2026-02-21 15:42:49.883856+00
bd3c22e4-1830-4641-b0f2-d4ca239702d6	ae753655-975c-481b-af1e-32adfca31fd5	shift_done	10	444e4a12-61d3-4e41-b036-0c9bba540171	2026-02-21 15:42:49.883856+00
428aaafb-d7da-4f15-9d50-75c78f521910	ae753655-975c-481b-af1e-32adfca31fd5	shift_done	10	8576e532-cd13-458e-a59e-da973d0300ee	2026-02-21 15:42:49.883856+00
0044a36f-002e-489b-9d5d-ae223b941522	ae753655-975c-481b-af1e-32adfca31fd5	shift_done	10	af6fdc73-9585-4836-af77-c609a23e047d	2026-02-21 15:42:49.883856+00
6e53b3b7-9ef1-4621-83ae-68a2edd97251	0b9c1fdb-76c4-4498-91d7-94336e012d88	shift_done	10	a3710187-6775-4b54-8af6-2a6618182050	2026-02-21 15:42:49.883856+00
133965a1-7099-4009-a060-22c6f4e814f4	fb617735-4e5d-4261-92d8-6636af4b1e98	shift_done	10	3db5629f-ed56-48dd-9e15-f6955743a40f	2026-02-21 15:42:49.883856+00
cd8015a1-2bef-474f-b8e3-aa0560973f65	2a396c7c-6b41-4eec-a98b-4494061569c1	shift_done	10	e576766a-cc91-4e26-a787-7c8ee509487f	2026-02-21 15:42:49.883856+00
c55cdcd6-e6cc-42d7-9746-881b8fec9d96	0fbd2c0a-db10-4772-bfc7-6f20eec97256	shift_done	10	8c37925f-f760-49c7-90ed-2117676b8097	2026-02-21 15:42:49.883856+00
58c6f398-cc47-4096-b46c-48f6413b7cdc	21baacfe-5b7c-4e70-8671-bd3d8783661e	shift_done	10	90cf17e7-dc6c-48dd-8921-24166cecaef5	2026-02-21 15:42:49.883856+00
918c51ba-ddea-4ca9-a105-b4b1afc54812	d38bbea6-2e50-4df6-817f-ad5d86848f85	shift_missed	-15	0ba83a6c-58c4-415a-8a21-b9cadbc494cd	2026-02-21 15:42:49.883856+00
81c54746-d544-46d0-8edd-fe658a80192f	ebfc8bab-f7f1-408c-9906-33360ff16352	shift_missed	-15	7a9ea046-b6b2-43ad-99b1-22fa507fdecc	2026-02-21 15:42:49.883856+00
c14e0f74-55b0-448d-bdea-145537557c12	f840c063-79b6-4796-ab93-0352c789621b	shift_missed	-15	7e4c5c1f-162b-4148-aac3-fb8c4ea23c97	2026-02-21 15:42:49.883856+00
6f1fb8c6-8a64-4b7f-91a5-38f0c23b96f7	f81f5db4-5891-4092-9ee4-107c5ecaf8ae	lead_weekly	5	\N	2026-02-23 06:00:00.22248+00
7f8a13f4-1bba-4955-ba64-258ab404022d	3ded5547-53e8-4e54-9344-8cce4dc14002	lead_weekly	5	\N	2026-02-23 06:00:00.22248+00
b738c499-d744-4fea-a715-dd2a995bcfc2	0b9c1fdb-76c4-4498-91d7-94336e012d88	material_small	5	43e6ea00-a170-4a44-93e0-2b30abbefb0b	2026-02-21 16:16:20.935423+00
962991bd-b5e5-4a1f-b68f-7763bde16114	e9797fb7-1cf3-45f9-aeff-0ab875fbcb9e	score_import	14	\N	2026-02-17 17:14:34.444319+00
4749fbef-28bf-4b6c-ae44-fecd430ef758	21e2920a-e09c-4142-a3df-fe2ea1b14ba1	score_import	13	\N	2026-02-17 17:14:34.789861+00
62a0d551-f44d-4df6-824c-0e5f37b253be	59398199-9c7a-4281-b572-a2a9fcd83b27	score_import	5	\N	2026-02-17 17:14:37.648672+00
3d1edac2-b3af-4f36-a893-6861dfacd56f	b049eec4-0635-4b8c-a336-d4718ab68292	score_import	4	\N	2026-02-17 17:14:38.042392+00
c819601b-318d-4592-bcfe-5e695ec9b222	e6b3dc9b-b519-49b0-806f-c046db6bdae7	score_import	41	\N	2026-02-17 17:14:41.934071+00
668f9cd0-b38a-4e07-a28c-5b42a79a891e	8d3130a7-59f2-44d2-94c6-1d475c6d9206	score_import	23	\N	2026-02-17 17:14:42.445905+00
d12eb515-ab1e-479e-b62d-b97faa853805	05eaabfe-209d-489a-8c4e-7ad880d09e0b	score_import	20	\N	2026-02-17 17:14:42.828115+00
8ed06307-cd10-4b67-9e8b-c88ace4d88f3	1af16130-366f-4b4f-8076-7fca77da4b66	score_import	4	\N	2026-02-17 17:14:43.145821+00
460fa009-9117-4813-a311-d70f2607acad	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	score_import	13	\N	2026-02-17 17:14:44.851741+00
5180786c-8453-4dcf-acb1-d1a93e2bed9f	ee0cc14f-3426-4384-b32b-7a00169cf4d2	material_small	5	43e6ea00-a170-4a44-93e0-2b30abbefb0b	2026-02-21 16:16:20.935423+00
0b8b4d85-ce4b-4bc7-baeb-3944408bbe45	a9438f32-a5ac-4b94-a095-d06b6868e175	score_import	0	\N	2026-02-17 17:14:47.593971+00
\.


--
-- Data for Name: engagement_scores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.engagement_scores (user_id, score, updated_at) FROM stdin;
38e8b432-d0f4-4b2e-9da8-6838c34f80d2	2	2026-02-17 17:14:23.572212+00
b049eec4-0635-4b8c-a336-d4718ab68292	4	2026-02-17 17:14:38.042392+00
9086573c-3165-4ca1-98f5-0ee63d166a51	49	2026-02-21 16:11:07.193897+00
8d3130a7-59f2-44d2-94c6-1d475c6d9206	48	2026-02-21 16:11:07.193897+00
8c458cd0-6f10-4a1b-946b-7900c9f8809a	51	2026-02-21 16:11:07.193897+00
623d3518-9e98-4ed6-8f22-4b01643f2067	12	2026-02-21 16:11:07.193897+00
7416ecdf-8e2f-4ba1-b4dc-bce1732d465c	68	2026-02-21 16:13:39.452546+00
6566d05b-38ca-4cbf-b357-e3f2dd49effc	18	2026-02-21 16:15:01.486908+00
a1895e74-3246-4fe7-9fdc-92c2948aaeff	54	2026-02-21 16:15:52.888293+00
df8dbdbe-bf23-4f19-b168-f5eed5fb2166	20	2026-02-21 16:15:52.888293+00
28b5b4a3-0664-42a9-930b-6d01267b0a22	35	2026-02-21 16:20:46.990738+00
59398199-9c7a-4281-b572-a2a9fcd83b27	20	2026-02-21 16:20:46.990738+00
6049cadd-55d3-404d-9cd2-f2459cf11025	18	2026-02-21 16:20:46.990738+00
3793d0d4-c471-4b87-bf07-827e5a67a3c4	48	2026-02-21 15:42:49.883856+00
896e664e-b5e5-435c-9ed7-bdc7ffa9c96c	2	2026-02-17 17:14:41.566445+00
1365befb-d2a2-4bc0-921a-b15653ee9843	28	2026-02-17 17:14:26.694156+00
74238ae3-a766-4d2b-94b7-d268634f34f9	117	2026-02-23 06:00:00.22248+00
0151d2e9-3b89-46ef-b581-a2ea5c64e909	111	2026-02-23 06:00:00.22248+00
70d84a7b-8609-44fd-aa06-e70bc186a8aa	103	2026-02-23 06:00:00.22248+00
e6b3dc9b-b519-49b0-806f-c046db6bdae7	51	2026-02-23 06:00:00.22248+00
5a0cce79-d26c-4e3f-ba5b-46021ac5b890	3	2026-02-21 15:42:49.883856+00
08b67870-12bd-46be-8a3c-8d08c248636a	90	2026-02-23 06:00:00.22248+00
165bad43-85d3-414c-954d-66df5a15139a	83	2026-02-23 06:00:00.22248+00
907f8218-3086-4432-9574-1b6a390d215b	110	2026-02-23 06:00:00.22248+00
f81f5db4-5891-4092-9ee4-107c5ecaf8ae	52	2026-02-23 06:00:00.22248+00
3ded5547-53e8-4e54-9344-8cce4dc14002	67	2026-02-23 06:00:00.22248+00
57642b40-f142-4630-bab0-e798318d4d6b	14	2026-02-21 15:42:49.883856+00
e0a3bb8d-2760-4b38-a876-63cd1df28bfb	14	2026-02-25 10:13:14.059476+00
2afeb807-dc52-4d21-9870-d2d67aa4255c	15	2026-02-17 17:14:44.544912+00
2bb4b8b0-a78b-4d63-b1ce-592bef579fd4	17	2026-02-25 10:13:14.059476+00
0451673c-60d8-4b08-8193-3adc46a549a8	13	2026-02-21 15:42:49.883856+00
d7f098df-6e33-4a55-a531-24ac8759a34b	9	2026-02-17 17:14:29.51737+00
45d8f8ee-0b52-4d2c-a068-cda116b0e586	14	2026-02-21 15:42:49.883856+00
5be1e6da-ed38-43be-8077-8aea7ab9ef6a	24	2026-02-17 17:14:29.858944+00
23998be1-ab7f-47f2-bef7-a2827030578a	80	2026-02-17 17:14:46.113045+00
2bde02ee-e6ab-4297-a3a0-f159709e470d	19	2026-02-17 17:14:31.742487+00
aa9b4464-9430-4d27-a8a0-24ca1fcca09c	51	2026-02-17 17:14:32.331216+00
03d616e1-41ca-4f77-b563-ed718288e7ef	1	2026-02-17 17:14:47.03915+00
fd148e93-0793-4394-a1a9-7782d6002404	27	2026-02-21 15:42:49.883856+00
26cca66b-02e0-430e-81b2-64b17f4b1167	7	2026-02-21 15:42:49.883856+00
a41d6ab1-9025-4181-bec7-e707d794420c	11	2026-02-21 15:42:49.883856+00
98b53fa0-2ca3-4001-8ad9-5180158ecd20	13	2026-02-21 15:42:49.883856+00
03cded49-8619-437e-a78f-7d3bfa86a5fb	-3	2026-02-21 15:37:14.186689+00
05eaabfe-209d-489a-8c4e-7ad880d09e0b	20	2026-02-21 15:37:14.186689+00
d0315046-f60a-4f1a-a181-d8d6119b421a	-6	2026-02-17 17:14:48.869324+00
253b11de-a5ee-4852-87a9-99af7f2bc3f4	83	2026-02-21 15:37:14.186689+00
1af16130-366f-4b4f-8076-7fca77da4b66	4	2026-02-21 15:42:49.883856+00
2acd81dc-9e33-4b30-97cf-9c822f8009e6	45	2026-02-17 17:14:50.47426+00
477555a6-934a-48b1-801d-988da7a28da0	46	2026-02-17 17:14:37.309816+00
21e2920a-e09c-4142-a3df-fe2ea1b14ba1	23	2026-02-21 15:42:49.883856+00
d4044703-c597-4577-ab1f-f0b12096a8d1	10	2026-02-21 15:42:49.883856+00
95ee11d0-717c-484d-b1b5-280f728566e2	7	2026-02-21 15:42:49.883856+00
e9797fb7-1cf3-45f9-aeff-0ab875fbcb9e	34	2026-02-21 15:42:49.883856+00
ae753655-975c-481b-af1e-32adfca31fd5	63	2026-02-21 15:42:49.883856+00
2a396c7c-6b41-4eec-a98b-4494061569c1	61	2026-02-21 16:13:39.452546+00
a711cdba-03a9-46e9-a894-f81a77c001ef	31	2026-02-21 16:15:01.486908+00
21baacfe-5b7c-4e70-8671-bd3d8783661e	56	2026-02-21 16:15:01.486908+00
0b9c1fdb-76c4-4498-91d7-94336e012d88	40	2026-02-21 16:16:20.935423+00
447af2c6-92b5-4f03-b4b5-7daabe3c31c8	-18	2026-02-21 01:05:05.811821+00
ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	73	2026-02-21 16:20:46.990738+00
ee0cc14f-3426-4384-b32b-7a00169cf4d2	24	2026-02-21 16:20:46.990738+00
f840c063-79b6-4796-ab93-0352c789621b	-12	2026-02-21 15:42:49.883856+00
a9438f32-a5ac-4b94-a095-d06b6868e175	10	2026-02-25 10:48:02.608568+00
0100e980-5d63-4dde-bdd1-49a049bef21e	1	2026-02-17 17:14:43.962415+00
e9c2aaeb-a7f2-4325-bb27-16c684057330	-3	2026-02-21 15:37:14.186689+00
fe64278a-c760-4945-bdc7-eb94d7e0bb79	-17	2026-02-21 15:37:14.186689+00
aae21dd6-8a37-4a44-aa72-961c91ccc9bb	8	2026-02-21 15:42:49.883856+00
ecdb1373-7081-4118-826d-93841fe544db	11	2026-02-21 15:42:49.883856+00
4eda936c-af7b-4c63-9f15-1e4bf99e235b	88	2026-02-21 15:42:49.883856+00
fb617735-4e5d-4261-92d8-6636af4b1e98	31	2026-02-21 15:42:49.883856+00
0fbd2c0a-db10-4772-bfc7-6f20eec97256	23	2026-02-21 15:42:49.883856+00
d38bbea6-2e50-4df6-817f-ad5d86848f85	-7	2026-02-21 15:42:49.883856+00
ebfc8bab-f7f1-408c-9906-33360ff16352	-21	2026-02-21 15:42:49.883856+00
\.


--
-- Data for Name: material_procurement_participants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.material_procurement_participants (material_id, user_id) FROM stdin;
9a29a8a1-9a47-40a7-8935-24f2751b6eb0	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44
9a29a8a1-9a47-40a7-8935-24f2751b6eb0	9086573c-3165-4ca1-98f5-0ee63d166a51
9a29a8a1-9a47-40a7-8935-24f2751b6eb0	8d3130a7-59f2-44d2-94c6-1d475c6d9206
9a29a8a1-9a47-40a7-8935-24f2751b6eb0	8c458cd0-6f10-4a1b-946b-7900c9f8809a
9a29a8a1-9a47-40a7-8935-24f2751b6eb0	623d3518-9e98-4ed6-8f22-4b01643f2067
8a85fe7c-5042-4a45-be4c-27b97cf6bde1	7416ecdf-8e2f-4ba1-b4dc-bce1732d465c
8a85fe7c-5042-4a45-be4c-27b97cf6bde1	74238ae3-a766-4d2b-94b7-d268634f34f9
8a85fe7c-5042-4a45-be4c-27b97cf6bde1	2a396c7c-6b41-4eec-a98b-4494061569c1
8a85fe7c-5042-4a45-be4c-27b97cf6bde1	f81f5db4-5891-4092-9ee4-107c5ecaf8ae
f2518691-7736-4a50-9c78-274fbe6c382a	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44
f2518691-7736-4a50-9c78-274fbe6c382a	a711cdba-03a9-46e9-a894-f81a77c001ef
f2518691-7736-4a50-9c78-274fbe6c382a	21baacfe-5b7c-4e70-8671-bd3d8783661e
f2518691-7736-4a50-9c78-274fbe6c382a	6566d05b-38ca-4cbf-b357-e3f2dd49effc
f2518691-7736-4a50-9c78-274fbe6c382a	28b5b4a3-0664-42a9-930b-6d01267b0a22
67b0a391-8bf9-42b5-8a55-6fd68e6a70f7	a1895e74-3246-4fe7-9fdc-92c2948aaeff
67b0a391-8bf9-42b5-8a55-6fd68e6a70f7	df8dbdbe-bf23-4f19-b168-f5eed5fb2166
67b0a391-8bf9-42b5-8a55-6fd68e6a70f7	3ded5547-53e8-4e54-9344-8cce4dc14002
43e6ea00-a170-4a44-93e0-2b30abbefb0b	0b9c1fdb-76c4-4498-91d7-94336e012d88
43e6ea00-a170-4a44-93e0-2b30abbefb0b	ee0cc14f-3426-4384-b32b-7a00169cf4d2
3e848bdc-8daa-4950-8a29-da3a92d95e22	907f8218-3086-4432-9574-1b6a390d215b
31bd433a-8e4d-42ca-98a6-324e5e44b8b2	28b5b4a3-0664-42a9-930b-6d01267b0a22
31bd433a-8e4d-42ca-98a6-324e5e44b8b2	59398199-9c7a-4281-b572-a2a9fcd83b27
31bd433a-8e4d-42ca-98a6-324e5e44b8b2	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44
31bd433a-8e4d-42ca-98a6-324e5e44b8b2	ee0cc14f-3426-4384-b32b-7a00169cf4d2
31bd433a-8e4d-42ca-98a6-324e5e44b8b2	6049cadd-55d3-404d-9cd2-f2459cf11025
290d3cec-b163-4962-8d02-2f835fd279e2	0151d2e9-3b89-46ef-b581-a2ea5c64e909
290d3cec-b163-4962-8d02-2f835fd279e2	74238ae3-a766-4d2b-94b7-d268634f34f9
d8e86168-283d-498f-870d-bcdc7e491386	907f8218-3086-4432-9574-1b6a390d215b
9b7d8a6f-e98a-4a73-a15a-c3f4933d9753	e0a3bb8d-2760-4b38-a876-63cd1df28bfb
9b7d8a6f-e98a-4a73-a15a-c3f4933d9753	2bb4b8b0-a78b-4d63-b1ce-592bef579fd4
bd34debe-23bd-421a-bbe2-5ee85f614e66	a9438f32-a5ac-4b94-a095-d06b6868e175
\.


--
-- Data for Name: material_procurements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.material_procurements (id, user_id, event_name, item_description, size, proof_url, verified_by, verified_at, created_at) FROM stdin;
9a29a8a1-9a47-40a7-8935-24f2751b6eb0	\N	Karnevalparty	Kuchen	small	\N	\N	\N	2026-02-21 16:11:06.914036+00
8a85fe7c-5042-4a45-be4c-27b97cf6bde1	\N	Karnvalparty	Muffins	small	\N	\N	\N	2026-02-21 16:13:39.173073+00
f2518691-7736-4a50-9c78-274fbe6c382a	\N	Karnevalparty	Waffelteig + Eisen	medium	\N	\N	\N	2026-02-21 16:15:01.127386+00
67b0a391-8bf9-42b5-8a55-6fd68e6a70f7	\N	Karnevalparty	Lauge (Brezeln, Laugenstange)	small	\N	\N	\N	2026-02-21 16:15:52.6331+00
43e6ea00-a170-4a44-93e0-2b30abbefb0b	\N	Karnevalparty	Süßigkeitenspieße	small	\N	\N	\N	2026-02-21 16:16:20.64998+00
3e848bdc-8daa-4950-8a29-da3a92d95e22	\N	Karnevalparty	Amerikaner	small	\N	\N	\N	2026-02-21 16:17:31.952877+00
31bd433a-8e4d-42ca-98a6-324e5e44b8b2	\N	Karnevalparty	Servietten	small	\N	\N	\N	2026-02-21 16:20:46.75994+00
290d3cec-b163-4962-8d02-2f835fd279e2	\N	Blutspende	Vollständige Organisation	large	\N	\N	\N	2026-02-22 14:03:21.35284+00
d8e86168-283d-498f-870d-bcdc7e491386	\N	Karnevalsparty	Organisatio	large	\N	\N	\N	2026-02-22 17:46:08.066958+00
9b7d8a6f-e98a-4a73-a15a-c3f4933d9753	\N	Kuchenverkauf	Mehrmals	small	\N	\N	\N	2026-02-25 10:13:13.818318+00
bd34debe-23bd-421a-bbe2-5ee85f614e66	\N	Coupons	Leffers 10% Coupons	medium	\N	\N	\N	2026-02-25 10:48:02.324189+00
\.


--
-- Data for Name: profile_committees; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profile_committees (user_id, committee_id) FROM stdin;
fd148e93-0793-4394-a1a9-7782d6002404	72d82b43-e80a-496d-b100-a97de18f3aa5
fd148e93-0793-4394-a1a9-7782d6002404	40f958ef-028c-44eb-9752-516eb7f549fb
38e8b432-d0f4-4b2e-9da8-6838c34f80d2	72d82b43-e80a-496d-b100-a97de18f3aa5
253b11de-a5ee-4852-87a9-99af7f2bc3f4	72d82b43-e80a-496d-b100-a97de18f3aa5
253b11de-a5ee-4852-87a9-99af7f2bc3f4	2eeded59-adf9-40a6-adee-652af2883805
253b11de-a5ee-4852-87a9-99af7f2bc3f4	5f127eaf-2d18-48ed-a03c-cb71e66181c1
253b11de-a5ee-4852-87a9-99af7f2bc3f4	bced722a-7c28-4374-a7bc-7c185bbd7916
f81f5db4-5891-4092-9ee4-107c5ecaf8ae	40f958ef-028c-44eb-9752-516eb7f549fb
f81f5db4-5891-4092-9ee4-107c5ecaf8ae	72d82b43-e80a-496d-b100-a97de18f3aa5
3ded5547-53e8-4e54-9344-8cce4dc14002	bced722a-7c28-4374-a7bc-7c185bbd7916
3ded5547-53e8-4e54-9344-8cce4dc14002	2eeded59-adf9-40a6-adee-652af2883805
2bb4b8b0-a78b-4d63-b1ce-592bef579fd4	5d2aff9a-ed88-4bae-be9b-3e43d939608a
2bb4b8b0-a78b-4d63-b1ce-592bef579fd4	72d82b43-e80a-496d-b100-a97de18f3aa5
7416ecdf-8e2f-4ba1-b4dc-bce1732d465c	5d2aff9a-ed88-4bae-be9b-3e43d939608a
a1895e74-3246-4fe7-9fdc-92c2948aaeff	2eeded59-adf9-40a6-adee-652af2883805
a1895e74-3246-4fe7-9fdc-92c2948aaeff	bced722a-7c28-4374-a7bc-7c185bbd7916
1365befb-d2a2-4bc0-921a-b15653ee9843	3ab92487-5995-4bb7-82c2-85a2e67eccd5
1365befb-d2a2-4bc0-921a-b15653ee9843	bced722a-7c28-4374-a7bc-7c185bbd7916
6049cadd-55d3-404d-9cd2-f2459cf11025	5f127eaf-2d18-48ed-a03c-cb71e66181c1
6049cadd-55d3-404d-9cd2-f2459cf11025	40f958ef-028c-44eb-9752-516eb7f549fb
8c458cd0-6f10-4a1b-946b-7900c9f8809a	5d2aff9a-ed88-4bae-be9b-3e43d939608a
0b9c1fdb-76c4-4498-91d7-94336e012d88	7db1a51d-a706-465b-85e1-3f1fa797af79
03cded49-8619-437e-a78f-7d3bfa86a5fb	72d82b43-e80a-496d-b100-a97de18f3aa5
45d8f8ee-0b52-4d2c-a068-cda116b0e586	40f958ef-028c-44eb-9752-516eb7f549fb
5be1e6da-ed38-43be-8077-8aea7ab9ef6a	3ab92487-5995-4bb7-82c2-85a2e67eccd5
e9c2aaeb-a7f2-4325-bb27-16c684057330	5f127eaf-2d18-48ed-a03c-cb71e66181c1
e9c2aaeb-a7f2-4325-bb27-16c684057330	40f958ef-028c-44eb-9752-516eb7f549fb
ae753655-975c-481b-af1e-32adfca31fd5	5f127eaf-2d18-48ed-a03c-cb71e66181c1
ae753655-975c-481b-af1e-32adfca31fd5	3ab92487-5995-4bb7-82c2-85a2e67eccd5
2bde02ee-e6ab-4297-a3a0-f159709e470d	5d2aff9a-ed88-4bae-be9b-3e43d939608a
aa9b4464-9430-4d27-a8a0-24ca1fcca09c	2eeded59-adf9-40a6-adee-652af2883805
28b5b4a3-0664-42a9-930b-6d01267b0a22	40f958ef-028c-44eb-9752-516eb7f549fb
26cca66b-02e0-430e-81b2-64b17f4b1167	bced722a-7c28-4374-a7bc-7c185bbd7916
0451673c-60d8-4b08-8193-3adc46a549a8	5f127eaf-2d18-48ed-a03c-cb71e66181c1
0451673c-60d8-4b08-8193-3adc46a549a8	72d82b43-e80a-496d-b100-a97de18f3aa5
e9797fb7-1cf3-45f9-aeff-0ab875fbcb9e	5d2aff9a-ed88-4bae-be9b-3e43d939608a
0fbd2c0a-db10-4772-bfc7-6f20eec97256	5d2aff9a-ed88-4bae-be9b-3e43d939608a
fb617735-4e5d-4261-92d8-6636af4b1e98	5f127eaf-2d18-48ed-a03c-cb71e66181c1
fb617735-4e5d-4261-92d8-6636af4b1e98	3ab92487-5995-4bb7-82c2-85a2e67eccd5
59398199-9c7a-4281-b572-a2a9fcd83b27	40f958ef-028c-44eb-9752-516eb7f549fb
aae21dd6-8a37-4a44-aa72-961c91ccc9bb	5f127eaf-2d18-48ed-a03c-cb71e66181c1
aae21dd6-8a37-4a44-aa72-961c91ccc9bb	72d82b43-e80a-496d-b100-a97de18f3aa5
aae21dd6-8a37-4a44-aa72-961c91ccc9bb	40f958ef-028c-44eb-9752-516eb7f549fb
98b53fa0-2ca3-4001-8ad9-5180158ecd20	bced722a-7c28-4374-a7bc-7c185bbd7916
907f8218-3086-4432-9574-1b6a390d215b	2eeded59-adf9-40a6-adee-652af2883805
907f8218-3086-4432-9574-1b6a390d215b	bced722a-7c28-4374-a7bc-7c185bbd7916
74238ae3-a766-4d2b-94b7-d268634f34f9	2eeded59-adf9-40a6-adee-652af2883805
74238ae3-a766-4d2b-94b7-d268634f34f9	5f127eaf-2d18-48ed-a03c-cb71e66181c1
0151d2e9-3b89-46ef-b581-a2ea5c64e909	5f127eaf-2d18-48ed-a03c-cb71e66181c1
0151d2e9-3b89-46ef-b581-a2ea5c64e909	2eeded59-adf9-40a6-adee-652af2883805
0151d2e9-3b89-46ef-b581-a2ea5c64e909	72d82b43-e80a-496d-b100-a97de18f3aa5
70d84a7b-8609-44fd-aa06-e70bc186a8aa	7db1a51d-a706-465b-85e1-3f1fa797af79
e6b3dc9b-b519-49b0-806f-c046db6bdae7	3ab92487-5995-4bb7-82c2-85a2e67eccd5
e6b3dc9b-b519-49b0-806f-c046db6bdae7	5d2aff9a-ed88-4bae-be9b-3e43d939608a
8d3130a7-59f2-44d2-94c6-1d475c6d9206	7db1a51d-a706-465b-85e1-3f1fa797af79
05eaabfe-209d-489a-8c4e-7ad880d09e0b	2eeded59-adf9-40a6-adee-652af2883805
05eaabfe-209d-489a-8c4e-7ad880d09e0b	5f127eaf-2d18-48ed-a03c-cb71e66181c1
f840c063-79b6-4796-ab93-0352c789621b	72d82b43-e80a-496d-b100-a97de18f3aa5
08b67870-12bd-46be-8a3c-8d08c248636a	7db1a51d-a706-465b-85e1-3f1fa797af79
08b67870-12bd-46be-8a3c-8d08c248636a	2eeded59-adf9-40a6-adee-652af2883805
08b67870-12bd-46be-8a3c-8d08c248636a	5f127eaf-2d18-48ed-a03c-cb71e66181c1
08b67870-12bd-46be-8a3c-8d08c248636a	3ab92487-5995-4bb7-82c2-85a2e67eccd5
4eda936c-af7b-4c63-9f15-1e4bf99e235b	5f127eaf-2d18-48ed-a03c-cb71e66181c1
4eda936c-af7b-4c63-9f15-1e4bf99e235b	3ab92487-5995-4bb7-82c2-85a2e67eccd5
95ee11d0-717c-484d-b1b5-280f728566e2	5d2aff9a-ed88-4bae-be9b-3e43d939608a
95ee11d0-717c-484d-b1b5-280f728566e2	5f127eaf-2d18-48ed-a03c-cb71e66181c1
57642b40-f142-4630-bab0-e798318d4d6b	5f127eaf-2d18-48ed-a03c-cb71e66181c1
d0315046-f60a-4f1a-a181-d8d6119b421a	5f127eaf-2d18-48ed-a03c-cb71e66181c1
d0315046-f60a-4f1a-a181-d8d6119b421a	40f958ef-028c-44eb-9752-516eb7f549fb
fe64278a-c760-4945-bdc7-eb94d7e0bb79	40f958ef-028c-44eb-9752-516eb7f549fb
3793d0d4-c471-4b87-bf07-827e5a67a3c4	5f127eaf-2d18-48ed-a03c-cb71e66181c1
3793d0d4-c471-4b87-bf07-827e5a67a3c4	3ab92487-5995-4bb7-82c2-85a2e67eccd5
2acd81dc-9e33-4b30-97cf-9c822f8009e6	7db1a51d-a706-465b-85e1-3f1fa797af79
2acd81dc-9e33-4b30-97cf-9c822f8009e6	3ab92487-5995-4bb7-82c2-85a2e67eccd5
165bad43-85d3-414c-954d-66df5a15139a	5d2aff9a-ed88-4bae-be9b-3e43d939608a
165bad43-85d3-414c-954d-66df5a15139a	2eeded59-adf9-40a6-adee-652af2883805
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profiles (id, full_name, role, committee_id, auth_user_id, email) FROM stdin;
23998be1-ab7f-47f2-bef7-a2827030578a	Leon Wenke	admin	\N	d7dd018b-e199-494e-8fb5-c10d63992b7a	leon.wenke@test.de
8c458cd0-6f10-4a1b-946b-7900c9f8809a	Imke Meints	member	5d2aff9a-ed88-4bae-be9b-3e43d939608a	\N	\N
0b9c1fdb-76c4-4498-91d7-94336e012d88	Kea Wilshusen	member	7db1a51d-a706-465b-85e1-3f1fa797af79	\N	\N
df8dbdbe-bf23-4f19-b168-f5eed5fb2166	Sarah Schlitt	member	\N	\N	\N
d7f098df-6e33-4a55-a531-24ac8759a34b	Zino Ley	member	\N	\N	\N
5be1e6da-ed38-43be-8077-8aea7ab9ef6a	Jara Lünemann	member	3ab92487-5995-4bb7-82c2-85a2e67eccd5	\N	\N
0451673c-60d8-4b08-8193-3adc46a549a8	Thore Daalmeyer	member	5f127eaf-2d18-48ed-a03c-cb71e66181c1	\N	\N
5a0cce79-d26c-4e3f-ba5b-46021ac5b890	Ruben Doosje	member	\N	\N	\N
e9797fb7-1cf3-45f9-aeff-0ab875fbcb9e	Sophia Beck	member	5d2aff9a-ed88-4bae-be9b-3e43d939608a	\N	\N
21e2920a-e09c-4142-a3df-fe2ea1b14ba1	Anja Gröger Valdez	member	\N	\N	\N
0fbd2c0a-db10-4772-bfc7-6f20eec97256	Louisa Cristal	member	5d2aff9a-ed88-4bae-be9b-3e43d939608a	\N	\N
21baacfe-5b7c-4e70-8671-bd3d8783661e	Ate Veenstra	member	\N	\N	\N
fb617735-4e5d-4261-92d8-6636af4b1e98	Zoe Kunanz	member	5f127eaf-2d18-48ed-a03c-cb71e66181c1	\N	\N
623d3518-9e98-4ed6-8f22-4b01643f2067	Wiebke Straat	member	\N	\N	\N
2a396c7c-6b41-4eec-a98b-4494061569c1	Elsa Bunjes	member	\N	\N	\N
477555a6-934a-48b1-801d-988da7a28da0	Gesa Wenninga	member	\N	\N	\N
59398199-9c7a-4281-b572-a2a9fcd83b27	Claas Frerichs	member	40f958ef-028c-44eb-9752-516eb7f549fb	\N	\N
b049eec4-0635-4b8c-a336-d4718ab68292	Henry Ulferts	member	\N	\N	\N
ee0cc14f-3426-4384-b32b-7a00169cf4d2	Amelie Hilbrands	member	\N	\N	\N
e0a3bb8d-2760-4b38-a876-63cd1df28bfb	Lennart Lauts	member	\N	\N	\N
6566d05b-38ca-4cbf-b357-e3f2dd49effc	Joris Theile	member	\N	\N	\N
896e664e-b5e5-435c-9ed7-bdc7ffa9c96c	Hanno Rademacher	member	\N	\N	\N
1af16130-366f-4b4f-8076-7fca77da4b66	Lara Malchus	member	\N	\N	\N
ecdb1373-7081-4118-826d-93841fe544db	Lammert Tergast	member	\N	\N	\N
0100e980-5d63-4dde-bdd1-49a049bef21e	Elias Kohn	member	\N	\N	\N
a41d6ab1-9025-4181-bec7-e707d794420c	Donata Linde	member	\N	\N	\N
2afeb807-dc52-4d21-9870-d2d67aa4255c	Eric Schön	member	\N	\N	\N
ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	Julia van der Zijl	member	\N	\N	\N
a711cdba-03a9-46e9-a894-f81a77c001ef	Rieka Bünting	member	\N	\N	\N
f840c063-79b6-4796-ab93-0352c789621b	Hanno Steffen	member	72d82b43-e80a-496d-b100-a97de18f3aa5	\N	\N
03d616e1-41ca-4f77-b563-ed718288e7ef	Jerrick Hinrichs	member	\N	\N	\N
d4044703-c597-4577-ab1f-f0b12096a8d1	Marie Spekker	member	\N	\N	\N
a9438f32-a5ac-4b94-a095-d06b6868e175	Rieke Goemann	member	\N	\N	\N
95ee11d0-717c-484d-b1b5-280f728566e2	Noah Baumann	member	5d2aff9a-ed88-4bae-be9b-3e43d939608a	\N	\N
57642b40-f142-4630-bab0-e798318d4d6b	Max Willers	member	5f127eaf-2d18-48ed-a03c-cb71e66181c1	\N	\N
d0315046-f60a-4f1a-a181-d8d6119b421a	Finja Heisig	member	5f127eaf-2d18-48ed-a03c-cb71e66181c1	\N	\N
ebfc8bab-f7f1-408c-9906-33360ff16352	Surena Mousavi	member	\N	\N	\N
3793d0d4-c471-4b87-bf07-827e5a67a3c4	Marit Wolters	member	5f127eaf-2d18-48ed-a03c-cb71e66181c1	\N	\N
2acd81dc-9e33-4b30-97cf-9c822f8009e6	Jannes Lehmann	member	7db1a51d-a706-465b-85e1-3f1fa797af79	\N	\N
d38bbea6-2e50-4df6-817f-ad5d86848f85	Danilo Schuster	member	\N	\N	\N
9086573c-3165-4ca1-98f5-0ee63d166a51	Jule Vogt	member	\N	\N	\N
fd148e93-0793-4394-a1a9-7782d6002404	Erik Slacki	member	72d82b43-e80a-496d-b100-a97de18f3aa5	\N	\N
38e8b432-d0f4-4b2e-9da8-6838c34f80d2	Maximilian Buse	member	72d82b43-e80a-496d-b100-a97de18f3aa5	\N	\N
2bb4b8b0-a78b-4d63-b1ce-592bef579fd4	Jannik Peters	member	5d2aff9a-ed88-4bae-be9b-3e43d939608a	\N	\N
7416ecdf-8e2f-4ba1-b4dc-bce1732d465c	Fabia Runde	member	5d2aff9a-ed88-4bae-be9b-3e43d939608a	\N	\N
a1895e74-3246-4fe7-9fdc-92c2948aaeff	Alina Folmer	member	2eeded59-adf9-40a6-adee-652af2883805	\N	\N
6049cadd-55d3-404d-9cd2-f2459cf11025	Charlotte Weber	member	5f127eaf-2d18-48ed-a03c-cb71e66181c1	\N	\N
03cded49-8619-437e-a78f-7d3bfa86a5fb	Jan-Renke de Vries	member	72d82b43-e80a-496d-b100-a97de18f3aa5	\N	\N
45d8f8ee-0b52-4d2c-a068-cda116b0e586	Enno Leemhuis	member	40f958ef-028c-44eb-9752-516eb7f549fb	\N	\N
e9c2aaeb-a7f2-4325-bb27-16c684057330	Enie Wichert	member	5f127eaf-2d18-48ed-a03c-cb71e66181c1	\N	\N
26cca66b-02e0-430e-81b2-64b17f4b1167	Mattis Bunger	member	bced722a-7c28-4374-a7bc-7c185bbd7916	\N	\N
98b53fa0-2ca3-4001-8ad9-5180158ecd20	Theo Halm	member	bced722a-7c28-4374-a7bc-7c185bbd7916	\N	\N
1365befb-d2a2-4bc0-921a-b15653ee9843	Tomke Eden	member	3ab92487-5995-4bb7-82c2-85a2e67eccd5	\N	\N
447af2c6-92b5-4f03-b4b5-7daabe3c31c8	Sophia Pham Thi	member	\N	\N	\N
8d3130a7-59f2-44d2-94c6-1d475c6d9206	Ritika Singh	member	7db1a51d-a706-465b-85e1-3f1fa797af79	\N	\N
05eaabfe-209d-489a-8c4e-7ad880d09e0b	Lana Wilken	member	2eeded59-adf9-40a6-adee-652af2883805	\N	\N
ae753655-975c-481b-af1e-32adfca31fd5	Mette Hajen	member	5f127eaf-2d18-48ed-a03c-cb71e66181c1	\N	\N
2bde02ee-e6ab-4297-a3a0-f159709e470d	Nike Janisch	member	5d2aff9a-ed88-4bae-be9b-3e43d939608a	\N	\N
aa9b4464-9430-4d27-a8a0-24ca1fcca09c	Jule Schilling	member	2eeded59-adf9-40a6-adee-652af2883805	\N	\N
aae21dd6-8a37-4a44-aa72-961c91ccc9bb	Jan Eden	member	5f127eaf-2d18-48ed-a03c-cb71e66181c1	\N	\N
4eda936c-af7b-4c63-9f15-1e4bf99e235b	Femke Lüning	member	5f127eaf-2d18-48ed-a03c-cb71e66181c1	\N	\N
fe64278a-c760-4945-bdc7-eb94d7e0bb79	Thies Groenewold	member	40f958ef-028c-44eb-9752-516eb7f549fb	\N	\N
28b5b4a3-0664-42a9-930b-6d01267b0a22	Julian Redetzky	member	40f958ef-028c-44eb-9752-516eb7f549fb	\N	\N
74238ae3-a766-4d2b-94b7-d268634f34f9	Hanna Gelten	lead	2eeded59-adf9-40a6-adee-652af2883805	5a3d80a7-70dd-4478-9a48-648efb2c1ac5	hanna-gelten@abi-orga.lead
253b11de-a5ee-4852-87a9-99af7f2bc3f4	Ellen Cammenga	member	72d82b43-e80a-496d-b100-a97de18f3aa5	7fdcaa14-9284-4643-9da3-3856ce0f4c45	ellen-cammenga@abi-orga.lead
0151d2e9-3b89-46ef-b581-a2ea5c64e909	Patricia Ruberg	lead	5f127eaf-2d18-48ed-a03c-cb71e66181c1	9a45589a-b8fe-4697-be47-1f597c6bc17e	patricia-ruberg@abi-orga.lead
70d84a7b-8609-44fd-aa06-e70bc186a8aa	Viktor Scholz	lead	7db1a51d-a706-465b-85e1-3f1fa797af79	e182d909-6563-4f7b-84bd-adbf18df43ca	viktor-scholz@abi-orga.lead
e6b3dc9b-b519-49b0-806f-c046db6bdae7	Tino Brinker	lead	3ab92487-5995-4bb7-82c2-85a2e67eccd5	41fdbeab-3460-46df-94da-3563e0b566d6	tino-brinker@abi-orga.lead
08b67870-12bd-46be-8a3c-8d08c248636a	Kristin Metz	lead	\N	9bf7a42e-d898-4577-b13b-bd00689b5ae5	kristin-metz@abi-orga.lead
165bad43-85d3-414c-954d-66df5a15139a	Jenola Feith	lead	5d2aff9a-ed88-4bae-be9b-3e43d939608a	2faec251-edd2-4457-982b-c0e217b27e23	jenola-feith@abi-orga.lead
907f8218-3086-4432-9574-1b6a390d215b	Celina Jütting	lead	2eeded59-adf9-40a6-adee-652af2883805	5f084bf8-77d9-4131-a1e1-1d1f5c79c761	celina-juetting@abi-orga.lead
f81f5db4-5891-4092-9ee4-107c5ecaf8ae	Janko Wulf	lead	40f958ef-028c-44eb-9752-516eb7f549fb	a8bbac1d-62c2-4d0e-be80-f627569bed7d	janko-wulf@abi-orga.lead
3ded5547-53e8-4e54-9344-8cce4dc14002	Leni Hickmann	lead	bced722a-7c28-4374-a7bc-7c185bbd7916	cde23fb7-668c-4355-976b-afdc57c2f248	leni-hickmann@abi-orga.lead
\.


--
-- Data for Name: score_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.score_events (id, user_id, kind, delta_load, delta_malus, source_type, source_id, created_at) FROM stdin;
f7723169-dab6-4195-9a92-67b4f1a5550d	2acd81dc-9e33-4b30-97cf-9c822f8009e6	task_verified	1	0	task	821e228d-743a-438c-bc60-04ab03c897a5	2026-02-17 17:10:08.439593+00
99f636d3-fc8b-49f6-a14b-7f5fc46e2b1f	f840c063-79b6-4796-ab93-0352c789621b	shift_missed	2	2	shift_assignment	fd3fd2c0-a6b2-49bc-8295-35190e9c18c8	2026-02-17 17:12:15.60877+00
7391dad9-6640-4323-8e9e-1e2e83c07583	d0315046-f60a-4f1a-a181-d8d6119b421a	shift_done	1	0	shift_assignment	86575332-5397-4a68-8442-1c60afef4c19	2026-02-17 17:12:21.603553+00
5dd43b53-2019-431a-893a-6f6433ac0202	d0315046-f60a-4f1a-a181-d8d6119b421a	shift_missed	2	2	shift_assignment	86575332-5397-4a68-8442-1c60afef4c19	2026-02-17 17:12:30.197572+00
508c70c3-1a81-41fe-9e8f-526899bd46ac	d0315046-f60a-4f1a-a181-d8d6119b421a	shift_done	1	0	shift_assignment	86575332-5397-4a68-8442-1c60afef4c19	2026-02-17 17:12:42.122953+00
9c96c75c-3a3e-4772-80aa-1ed8805b1648	f840c063-79b6-4796-ab93-0352c789621b	shift_done	1	0	shift_assignment	fd3fd2c0-a6b2-49bc-8295-35190e9c18c8	2026-02-17 17:12:47.482048+00
4e16a3ca-6cc9-4068-be17-47acd780030f	1af16130-366f-4b4f-8076-7fca77da4b66	shift_missed	2	2	shift_assignment	a3710187-6775-4b54-8af6-2a6618182050	2026-02-20 23:11:14.866526+00
333724df-1c19-4ac7-b38d-ee87bed70476	0451673c-60d8-4b08-8193-3adc46a549a8	shift_done	1	0	shift_assignment	955905c5-4138-4c1b-b6ea-ef01f55263ee	2026-02-20 23:11:24.795294+00
31aa1dd8-c15b-4df8-b51e-97770ed55f6c	3793d0d4-c471-4b87-bf07-827e5a67a3c4	shift_missed	2	2	shift_assignment	3db5629f-ed56-48dd-9e15-f6955743a40f	2026-02-20 23:11:33.502046+00
09624c6c-928e-430f-8092-60cd2f0d0cfd	d38bbea6-2e50-4df6-817f-ad5d86848f85	shift_missed	2	2	shift_assignment	0ba83a6c-58c4-415a-8a21-b9cadbc494cd	2026-02-20 23:11:37.265836+00
1dbfee6e-2714-41b4-a414-37eafb4fe961	4eda936c-af7b-4c63-9f15-1e4bf99e235b	shift_done	1	0	shift_assignment	2268961d-efc1-4053-855c-bbe81352ec92	2026-02-20 23:11:41.643532+00
b3c3c645-42a6-4f86-b337-8dcb90ddf38e	ee0cc14f-3426-4384-b32b-7a00169cf4d2	shift_done	1	0	shift_assignment	2cebaa88-4a41-4243-92fb-a71826abdfa4	2026-02-20 23:11:50.003566+00
38191455-2348-4720-960c-3370996058b1	a9438f32-a5ac-4b94-a095-d06b6868e175	shift_missed	2	2	shift_assignment	e576766a-cc91-4e26-a787-7c8ee509487f	2026-02-20 23:12:01.362273+00
68a4fdbf-501d-49b0-b1ce-746dd0251fc2	70d84a7b-8609-44fd-aa06-e70bc186a8aa	shift_done	1	0	shift_assignment	b7054507-fb88-4d9f-ba85-e06c920ebbcf	2026-02-20 23:12:03.952141+00
58237bb1-73a7-4fab-8101-26a574b899b9	5a0cce79-d26c-4e3f-ba5b-46021ac5b890	shift_missed	2	2	shift_assignment	8c37925f-f760-49c7-90ed-2117676b8097	2026-02-20 23:12:17.883111+00
f20866f5-2e88-4d98-b3c4-e86365e77473	a1895e74-3246-4fe7-9fdc-92c2948aaeff	shift_done	1	0	shift_assignment	58c43167-79f4-484a-a195-10a2e65015c0	2026-02-20 23:12:23.589576+00
4eb02e9f-65ad-4d7f-ae03-e1326da80dd8	45d8f8ee-0b52-4d2c-a068-cda116b0e586	shift_done	1	0	shift_assignment	b283b4bc-5db4-4720-b724-6856c99113d2	2026-02-20 23:12:32.039127+00
1afe6bc3-9107-4c2b-a4b2-67bc9c44c35a	28b5b4a3-0664-42a9-930b-6d01267b0a22	shift_done	1	0	shift_assignment	cdf2b8a9-6e85-4976-975e-d199793b66b9	2026-02-20 23:12:34.26507+00
2bf2f26a-231b-4909-8b1e-6c2b430e31f9	a1895e74-3246-4fe7-9fdc-92c2948aaeff	shift_done	1	0	shift_assignment	62c3e02f-1c3a-4a33-acc8-0d5e2d336b4c	2026-02-20 23:12:36.646469+00
c171bacc-b83a-4ffe-865d-7bb90d3689a6	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	shift_done	1	0	shift_assignment	fe6b7ec2-ebfc-4290-b030-a0955f68c564	2026-02-20 23:12:38.826084+00
e2ca9bca-0426-4011-85ea-4fe701991805	447af2c6-92b5-4f03-b4b5-7daabe3c31c8	shift_missed	2	2	shift_assignment	87fd1124-f698-4473-ad13-71eadbb862ff	2026-02-20 23:12:41.913+00
7e5d5d9f-d443-46d9-9251-a73496089259	ae753655-975c-481b-af1e-32adfca31fd5	shift_done	1	0	shift_assignment	d1e6441a-a058-42e6-80c6-0e1720d428af	2026-02-20 23:12:44.146855+00
10733439-c021-4f47-b297-b1d910682914	70d84a7b-8609-44fd-aa06-e70bc186a8aa	shift_done	1	0	shift_assignment	c62e5519-f749-47b5-a55c-7d3de3799725	2026-02-20 23:12:45.976316+00
79902f4b-7a1a-42e9-9d8f-2132931d7a74	e6b3dc9b-b519-49b0-806f-c046db6bdae7	shift_missed	2	2	shift_assignment	90cf17e7-dc6c-48dd-8921-24166cecaef5	2026-02-20 23:12:50.530795+00
7a048d2f-ddb3-4506-b068-0f70a0140f5f	6049cadd-55d3-404d-9cd2-f2459cf11025	shift_done	1	0	shift_assignment	c75854f8-479f-4fbb-87f3-112e63264ebf	2026-02-20 23:13:18.669633+00
02a54ca9-4097-4b87-9fee-4ce5ccfb34d6	4eda936c-af7b-4c63-9f15-1e4bf99e235b	shift_done	1	0	shift_assignment	012c3f08-d822-4a3c-a021-acca67889eba	2026-02-20 23:13:54.132848+00
f2a39157-1ee3-4198-b530-2acaf9ba33a8	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	shift_done	1	0	shift_assignment	55dac618-837d-4698-8a7a-5b16634edc21	2026-02-20 23:14:21.594441+00
57c4659d-5e36-47c0-8dcf-cf607cd66966	8d3130a7-59f2-44d2-94c6-1d475c6d9206	shift_done	1	0	shift_assignment	cf4cbc68-101c-4ef8-9b43-d4e6e8afca94	2026-02-20 23:14:50.270367+00
d9614cd8-8418-4cdb-8843-913637af483b	8d3130a7-59f2-44d2-94c6-1d475c6d9206	shift_done	1	0	shift_assignment	b2495732-db0d-4773-81dd-3d72cc5bb59c	2026-02-20 23:15:03.442581+00
ee7239bc-ed1c-48f8-b852-d2b151f417fa	aae21dd6-8a37-4a44-aa72-961c91ccc9bb	shift_done	1	0	shift_assignment	87c21942-c7e5-4e8e-bc65-2372fed38e0d	2026-02-20 23:15:26.172068+00
e9bc2f03-6ce9-4009-b75d-eff01fbb2ccb	fd148e93-0793-4394-a1a9-7782d6002404	shift_done	1	0	shift_assignment	131f7bc8-1148-4349-9355-54298e800831	2026-02-20 23:15:29.119391+00
bac38409-f73c-4f16-a625-ad0eb8a6ba48	ebfc8bab-f7f1-408c-9906-33360ff16352	shift_missed	2	2	shift_assignment	7a9ea046-b6b2-43ad-99b1-22fa507fdecc	2026-02-20 23:15:32.83666+00
285ab9e3-8c17-45cb-9bd9-fe5e515cf2a4	26cca66b-02e0-430e-81b2-64b17f4b1167	shift_done	1	0	shift_assignment	0d6c9da0-8878-4cdf-b6b8-938f7dba1fb1	2026-02-20 23:15:35.180604+00
19a4c500-e87d-47f9-a090-d8f785a278c4	a41d6ab1-9025-4181-bec7-e707d794420c	shift_done	1	0	shift_assignment	1d4ae073-d453-4df3-a932-1e415082548a	2026-02-20 23:15:37.047854+00
406fb61f-dafe-4113-aea0-1b3977a35d71	98b53fa0-2ca3-4001-8ad9-5180158ecd20	shift_done	1	0	shift_assignment	e11a6750-4623-4936-b921-216d704b3f33	2026-02-20 23:15:45.927158+00
a0a5e5f7-54a7-42a9-86de-9828ac98837a	7416ecdf-8e2f-4ba1-b4dc-bce1732d465c	shift_done	1	0	shift_assignment	6c924a14-74bf-431e-8410-a5dce6a1f1a8	2026-02-20 23:16:33.166829+00
12186563-d8f2-402f-ba05-56cd7ce11b72	70d84a7b-8609-44fd-aa06-e70bc186a8aa	shift_done	1	0	shift_assignment	7d1616e5-1185-4347-b5b0-8322b375fe89	2026-02-20 23:15:47.613743+00
c5cf00ef-6673-4242-8d79-0283c1fb7587	fe64278a-c760-4945-bdc7-eb94d7e0bb79	shift_missed	2	2	shift_assignment	f058d06d-f1a4-40bf-a828-316f5f318d1c	2026-02-20 23:15:52.739586+00
f75bd52e-295f-4b09-9390-9f20747d6dc2	9086573c-3165-4ca1-98f5-0ee63d166a51	shift_done	1	0	shift_assignment	cc4e5644-1d59-4587-a8e6-6db7c21dc692	2026-02-20 23:16:34.874351+00
75ab9301-b2cb-45c3-a166-97087db6b926	f840c063-79b6-4796-ab93-0352c789621b	shift_missed	2	2	shift_assignment	7e4c5c1f-162b-4148-aac3-fb8c4ea23c97	2026-02-20 23:15:50.647419+00
6267920d-d45d-4eff-907f-dc93935000b9	e9797fb7-1cf3-45f9-aeff-0ab875fbcb9e	shift_done	1	0	shift_assignment	053dd476-0cbd-43ab-b125-4761fc55e526	2026-02-20 23:16:30.901096+00
4a4c138c-a985-4ad4-ad80-4b627cb2ff99	9086573c-3165-4ca1-98f5-0ee63d166a51	shift_done	1	0	shift_assignment	49c0d716-8f10-4624-9008-31a75d4de219	2026-02-20 23:17:21.119183+00
72406f1c-669a-40d7-96e7-fb3239a4a721	21e2920a-e09c-4142-a3df-fe2ea1b14ba1	shift_done	1	0	shift_assignment	236432b1-145e-47f7-9db5-958bcef394cb	2026-02-20 23:17:23.03451+00
201a30d2-8e84-4d3e-91a5-c1045eb4fe00	df8dbdbe-bf23-4f19-b168-f5eed5fb2166	shift_done	1	0	shift_assignment	827f4fd2-28be-4120-ba36-d9229865104d	2026-02-20 23:17:24.91371+00
7c8c56e4-bc4d-4673-abe4-d5e71a9b61b5	57642b40-f142-4630-bab0-e798318d4d6b	shift_done	1	0	shift_assignment	7b35046f-d286-4c5e-8c14-88dc66b76194	2026-02-20 23:17:26.561918+00
9cf1fa7b-4107-4212-86b7-c060fcd61bde	d4044703-c597-4577-ab1f-f0b12096a8d1	shift_done	1	0	shift_assignment	081bd88d-e36b-4305-a39a-292e70503552	2026-02-20 23:17:28.12279+00
c7463105-758f-4db5-83eb-2966c4504708	ecdb1373-7081-4118-826d-93841fe544db	shift_done	1	0	shift_assignment	e235af45-1bd3-4f4d-a2e8-d487451edde0	2026-02-20 23:17:29.829661+00
78d27729-cf81-4c5e-a513-bafd58a7de5e	59398199-9c7a-4281-b572-a2a9fcd83b27	shift_done	1	0	shift_assignment	f0f63c32-356b-4555-a66a-cbdb1d6d8861	2026-02-20 23:17:31.297279+00
0dd615f7-ae76-44cd-8484-e868a0ee3c42	95ee11d0-717c-484d-b1b5-280f728566e2	shift_done	1	0	shift_assignment	2ae51e1b-94e4-4d79-8cf8-ead58be18363	2026-02-20 23:17:32.821011+00
04458ee4-4390-40bd-af45-ae9411b29a3b	70d84a7b-8609-44fd-aa06-e70bc186a8aa	shift_done	1	0	shift_assignment	62da48b8-6e5f-4cbf-b9f7-b9fe5e7c6d38	2026-02-20 23:17:34.365355+00
08af47df-1599-4d96-929b-9ca8ccd2acc6	7416ecdf-8e2f-4ba1-b4dc-bce1732d465c	shift_done	1	0	shift_assignment	639526b9-000b-4876-98be-33ddd0985a1f	2026-02-20 23:17:54.864654+00
cb300cd4-3ccb-48f2-ab91-0c6371bbb2d6	e9797fb7-1cf3-45f9-aeff-0ab875fbcb9e	shift_done	1	0	shift_assignment	58ea1783-f38a-4bcf-87e4-9681fce5f945	2026-02-20 23:17:56.644077+00
264580ff-08f5-428a-b2c4-d64a7ca18303	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	shift_done	1	0	shift_assignment	c1692f72-1b81-4cef-b142-b523ff042c50	2026-02-20 23:18:41.789906+00
97706823-e754-4259-b577-c051c95c31a2	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	shift_done	1	0	shift_assignment	5d681b3d-f49f-4865-8b41-1099f9bde82a	2026-02-20 23:18:55.62375+00
4a1d622d-aa94-4350-8c98-53c25ed731fd	4eda936c-af7b-4c63-9f15-1e4bf99e235b	shift_done	1	0	shift_assignment	5edf0298-46d4-4457-9d57-318de42506cc	2026-02-20 23:21:11.473617+00
35816c65-06e4-416e-a1d8-d88472e802bd	4eda936c-af7b-4c63-9f15-1e4bf99e235b	shift_done	1	0	shift_assignment	440c49b5-9b0e-4f47-9409-09835eea284e	2026-02-20 23:21:32.105305+00
23cb8108-277c-4e07-8468-0438b7073e52	ae753655-975c-481b-af1e-32adfca31fd5	shift_done	1	0	shift_assignment	444e4a12-61d3-4e41-b036-0c9bba540171	2026-02-20 23:23:02.661888+00
261f73aa-1a58-4018-a5d3-4eb33e877ebb	ae753655-975c-481b-af1e-32adfca31fd5	shift_done	1	0	shift_assignment	8576e532-cd13-458e-a59e-da973d0300ee	2026-02-20 23:23:50.40793+00
d5c9fe26-a151-41a9-a3c0-16c06ef0d283	ae753655-975c-481b-af1e-32adfca31fd5	shift_done	1	0	shift_assignment	af6fdc73-9585-4836-af77-c609a23e047d	2026-02-20 23:24:04.948697+00
6f0c3dce-5d68-4517-8a03-5c966441aefd	907f8218-3086-4432-9574-1b6a390d215b	shift_done	1	0	shift_assignment	60fde1e5-9b8d-40f0-9fa6-85035308dc20	2026-02-22 13:57:12.453344+00
49aff07c-d400-47f4-810e-5e71c6277fba	907f8218-3086-4432-9574-1b6a390d215b	shift_done	1	0	shift_assignment	9c5050d4-e4d1-41b7-9869-5febed577876	2026-02-22 13:57:27.53294+00
85380ddb-c2e8-4c93-ad5c-035f455dd912	907f8218-3086-4432-9574-1b6a390d215b	shift_done	1	0	shift_assignment	fc1f4217-b0ee-4202-9131-3927a9ce289e	2026-02-22 13:57:53.295351+00
\.


--
-- Data for Name: shift_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shift_assignments (id, shift_id, user_id, status, replacement_user_id, proof_url, created_at) FROM stdin;
c75854f8-479f-4fbb-87f3-112e63264ebf	3aafe10d-2a60-4d96-9f4a-f0abd001ebbc	6049cadd-55d3-404d-9cd2-f2459cf11025	erledigt	\N	\N	2026-02-20 23:13:16.476929+00
5edf0298-46d4-4457-9d57-318de42506cc	9ac39b85-efad-4f33-867b-605fdfea1b9d	4eda936c-af7b-4c63-9f15-1e4bf99e235b	erledigt	\N	\N	2026-02-20 23:21:08.476934+00
012c3f08-d822-4a3c-a021-acca67889eba	3aafe10d-2a60-4d96-9f4a-f0abd001ebbc	4eda936c-af7b-4c63-9f15-1e4bf99e235b	erledigt	\N	\N	2026-02-20 23:13:51.745772+00
a3710187-6775-4b54-8af6-2a6618182050	9ddb68cb-1c3a-4ac7-a148-068b1b4192d8	1af16130-366f-4b4f-8076-7fca77da4b66	abgesagt	0b9c1fdb-76c4-4498-91d7-94336e012d88	\N	2026-02-19 14:57:40.131872+00
955905c5-4138-4c1b-b6ea-ef01f55263ee	9ddb68cb-1c3a-4ac7-a148-068b1b4192d8	0451673c-60d8-4b08-8193-3adc46a549a8	erledigt	\N	\N	2026-02-19 14:57:40.131872+00
3db5629f-ed56-48dd-9e15-f6955743a40f	9ddb68cb-1c3a-4ac7-a148-068b1b4192d8	3793d0d4-c471-4b87-bf07-827e5a67a3c4	abgesagt	fb617735-4e5d-4261-92d8-6636af4b1e98	\N	2026-02-19 14:57:40.131872+00
0ba83a6c-58c4-415a-8a21-b9cadbc494cd	9ddb68cb-1c3a-4ac7-a148-068b1b4192d8	d38bbea6-2e50-4df6-817f-ad5d86848f85	abgesagt	\N	\N	2026-02-19 14:57:40.131872+00
2268961d-efc1-4053-855c-bbe81352ec92	9ddb68cb-1c3a-4ac7-a148-068b1b4192d8	4eda936c-af7b-4c63-9f15-1e4bf99e235b	erledigt	\N	\N	2026-02-19 14:57:40.131872+00
2cebaa88-4a41-4243-92fb-a71826abdfa4	9ddb68cb-1c3a-4ac7-a148-068b1b4192d8	ee0cc14f-3426-4384-b32b-7a00169cf4d2	erledigt	\N	\N	2026-02-19 14:57:40.131872+00
e576766a-cc91-4e26-a787-7c8ee509487f	9ddb68cb-1c3a-4ac7-a148-068b1b4192d8	a9438f32-a5ac-4b94-a095-d06b6868e175	abgesagt	2a396c7c-6b41-4eec-a98b-4494061569c1	\N	2026-02-19 14:57:40.131872+00
b7054507-fb88-4d9f-ba85-e06c920ebbcf	9ddb68cb-1c3a-4ac7-a148-068b1b4192d8	70d84a7b-8609-44fd-aa06-e70bc186a8aa	erledigt	\N	\N	2026-02-19 15:03:23.732713+00
8c37925f-f760-49c7-90ed-2117676b8097	9ddb68cb-1c3a-4ac7-a148-068b1b4192d8	5a0cce79-d26c-4e3f-ba5b-46021ac5b890	abgesagt	0fbd2c0a-db10-4772-bfc7-6f20eec97256	\N	2026-02-19 14:57:40.131872+00
58c43167-79f4-484a-a195-10a2e65015c0	9ddb68cb-1c3a-4ac7-a148-068b1b4192d8	a1895e74-3246-4fe7-9fdc-92c2948aaeff	erledigt	\N	\N	2026-02-20 15:18:15.67911+00
b283b4bc-5db4-4720-b724-6856c99113d2	3aafe10d-2a60-4d96-9f4a-f0abd001ebbc	45d8f8ee-0b52-4d2c-a068-cda116b0e586	erledigt	\N	\N	2026-02-19 14:57:39.968791+00
cdf2b8a9-6e85-4976-975e-d199793b66b9	3aafe10d-2a60-4d96-9f4a-f0abd001ebbc	28b5b4a3-0664-42a9-930b-6d01267b0a22	erledigt	\N	\N	2026-02-19 14:57:39.968791+00
62c3e02f-1c3a-4a33-acc8-0d5e2d336b4c	3aafe10d-2a60-4d96-9f4a-f0abd001ebbc	a1895e74-3246-4fe7-9fdc-92c2948aaeff	erledigt	\N	\N	2026-02-19 14:57:39.968791+00
fe6b7ec2-ebfc-4290-b030-a0955f68c564	3aafe10d-2a60-4d96-9f4a-f0abd001ebbc	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	erledigt	\N	\N	2026-02-19 14:57:39.968791+00
d1e6441a-a058-42e6-80c6-0e1720d428af	3aafe10d-2a60-4d96-9f4a-f0abd001ebbc	ae753655-975c-481b-af1e-32adfca31fd5	erledigt	\N	\N	2026-02-19 14:57:39.968791+00
c62e5519-f749-47b5-a55c-7d3de3799725	3aafe10d-2a60-4d96-9f4a-f0abd001ebbc	70d84a7b-8609-44fd-aa06-e70bc186a8aa	erledigt	\N	\N	2026-02-19 15:03:16.0634+00
90cf17e7-dc6c-48dd-8921-24166cecaef5	3aafe10d-2a60-4d96-9f4a-f0abd001ebbc	e6b3dc9b-b519-49b0-806f-c046db6bdae7	abgesagt	21baacfe-5b7c-4e70-8671-bd3d8783661e	\N	2026-02-19 14:57:39.968791+00
55dac618-837d-4698-8a7a-5b16634edc21	9ddb68cb-1c3a-4ac7-a148-068b1b4192d8	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	erledigt	\N	\N	2026-02-20 23:14:19.466465+00
cf4cbc68-101c-4ef8-9b43-d4e6e8afca94	3aafe10d-2a60-4d96-9f4a-f0abd001ebbc	8d3130a7-59f2-44d2-94c6-1d475c6d9206	erledigt	\N	\N	2026-02-20 23:14:48.198793+00
b2495732-db0d-4773-81dd-3d72cc5bb59c	9ddb68cb-1c3a-4ac7-a148-068b1b4192d8	8d3130a7-59f2-44d2-94c6-1d475c6d9206	erledigt	\N	\N	2026-02-20 23:15:01.370422+00
87c21942-c7e5-4e8e-bc65-2372fed38e0d	9ac39b85-efad-4f33-867b-605fdfea1b9d	aae21dd6-8a37-4a44-aa72-961c91ccc9bb	erledigt	\N	\N	2026-02-19 14:57:40.273055+00
131f7bc8-1148-4349-9355-54298e800831	9ac39b85-efad-4f33-867b-605fdfea1b9d	fd148e93-0793-4394-a1a9-7782d6002404	erledigt	\N	\N	2026-02-19 14:57:40.273055+00
7a9ea046-b6b2-43ad-99b1-22fa507fdecc	9ac39b85-efad-4f33-867b-605fdfea1b9d	ebfc8bab-f7f1-408c-9906-33360ff16352	abgesagt	\N	\N	2026-02-19 14:57:40.273055+00
0d6c9da0-8878-4cdf-b6b8-938f7dba1fb1	9ac39b85-efad-4f33-867b-605fdfea1b9d	26cca66b-02e0-430e-81b2-64b17f4b1167	erledigt	\N	\N	2026-02-19 14:57:40.273055+00
1d4ae073-d453-4df3-a932-1e415082548a	9ac39b85-efad-4f33-867b-605fdfea1b9d	a41d6ab1-9025-4181-bec7-e707d794420c	erledigt	\N	\N	2026-02-19 14:57:40.273055+00
e11a6750-4623-4936-b921-216d704b3f33	9ac39b85-efad-4f33-867b-605fdfea1b9d	98b53fa0-2ca3-4001-8ad9-5180158ecd20	erledigt	\N	\N	2026-02-19 14:57:40.273055+00
7d1616e5-1185-4347-b5b0-8322b375fe89	9ac39b85-efad-4f33-867b-605fdfea1b9d	70d84a7b-8609-44fd-aa06-e70bc186a8aa	erledigt	\N	\N	2026-02-19 15:03:36.062725+00
7e4c5c1f-162b-4148-aac3-fb8c4ea23c97	9ac39b85-efad-4f33-867b-605fdfea1b9d	f840c063-79b6-4796-ab93-0352c789621b	abgesagt	\N	\N	2026-02-19 14:57:40.273055+00
053dd476-0cbd-43ab-b125-4761fc55e526	9ac39b85-efad-4f33-867b-605fdfea1b9d	e9797fb7-1cf3-45f9-aeff-0ab875fbcb9e	erledigt	\N	\N	2026-02-20 23:16:11.492158+00
6c924a14-74bf-431e-8410-a5dce6a1f1a8	9ac39b85-efad-4f33-867b-605fdfea1b9d	7416ecdf-8e2f-4ba1-b4dc-bce1732d465c	erledigt	\N	\N	2026-02-20 23:16:19.237212+00
cc4e5644-1d59-4587-a8e6-6db7c21dc692	9ac39b85-efad-4f33-867b-605fdfea1b9d	9086573c-3165-4ca1-98f5-0ee63d166a51	erledigt	\N	\N	2026-02-20 23:16:28.954277+00
49c0d716-8f10-4624-9008-31a75d4de219	72f4c8bf-cdbb-4709-8ae8-b3bc9975eccc	9086573c-3165-4ca1-98f5-0ee63d166a51	erledigt	\N	\N	2026-02-19 14:57:40.46836+00
236432b1-145e-47f7-9db5-958bcef394cb	72f4c8bf-cdbb-4709-8ae8-b3bc9975eccc	21e2920a-e09c-4142-a3df-fe2ea1b14ba1	erledigt	\N	\N	2026-02-19 14:57:40.46836+00
827f4fd2-28be-4120-ba36-d9229865104d	72f4c8bf-cdbb-4709-8ae8-b3bc9975eccc	df8dbdbe-bf23-4f19-b168-f5eed5fb2166	erledigt	\N	\N	2026-02-19 14:57:40.46836+00
7b35046f-d286-4c5e-8c14-88dc66b76194	72f4c8bf-cdbb-4709-8ae8-b3bc9975eccc	57642b40-f142-4630-bab0-e798318d4d6b	erledigt	\N	\N	2026-02-19 14:57:40.46836+00
081bd88d-e36b-4305-a39a-292e70503552	72f4c8bf-cdbb-4709-8ae8-b3bc9975eccc	d4044703-c597-4577-ab1f-f0b12096a8d1	erledigt	\N	\N	2026-02-19 14:57:40.46836+00
e235af45-1bd3-4f4d-a2e8-d487451edde0	72f4c8bf-cdbb-4709-8ae8-b3bc9975eccc	ecdb1373-7081-4118-826d-93841fe544db	erledigt	\N	\N	2026-02-19 14:57:40.46836+00
f0f63c32-356b-4555-a66a-cbdb1d6d8861	72f4c8bf-cdbb-4709-8ae8-b3bc9975eccc	59398199-9c7a-4281-b572-a2a9fcd83b27	erledigt	\N	\N	2026-02-19 14:57:40.46836+00
2ae51e1b-94e4-4d79-8cf8-ead58be18363	72f4c8bf-cdbb-4709-8ae8-b3bc9975eccc	95ee11d0-717c-484d-b1b5-280f728566e2	erledigt	\N	\N	2026-02-19 14:57:40.46836+00
62da48b8-6e5f-4cbf-b9f7-b9fe5e7c6d38	72f4c8bf-cdbb-4709-8ae8-b3bc9975eccc	70d84a7b-8609-44fd-aa06-e70bc186a8aa	erledigt	\N	\N	2026-02-19 15:03:42.893443+00
639526b9-000b-4876-98be-33ddd0985a1f	72f4c8bf-cdbb-4709-8ae8-b3bc9975eccc	7416ecdf-8e2f-4ba1-b4dc-bce1732d465c	erledigt	\N	\N	2026-02-20 23:17:46.749071+00
58ea1783-f38a-4bcf-87e4-9681fce5f945	72f4c8bf-cdbb-4709-8ae8-b3bc9975eccc	e9797fb7-1cf3-45f9-aeff-0ab875fbcb9e	erledigt	\N	\N	2026-02-20 23:17:53.118469+00
c1692f72-1b81-4cef-b142-b523ff042c50	9ac39b85-efad-4f33-867b-605fdfea1b9d	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	erledigt	\N	\N	2026-02-20 23:18:28.651385+00
5d681b3d-f49f-4865-8b41-1099f9bde82a	72f4c8bf-cdbb-4709-8ae8-b3bc9975eccc	ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	erledigt	\N	\N	2026-02-20 23:18:53.1466+00
440c49b5-9b0e-4f47-9409-09835eea284e	72f4c8bf-cdbb-4709-8ae8-b3bc9975eccc	4eda936c-af7b-4c63-9f15-1e4bf99e235b	erledigt	\N	\N	2026-02-20 23:21:23.430219+00
444e4a12-61d3-4e41-b036-0c9bba540171	72f4c8bf-cdbb-4709-8ae8-b3bc9975eccc	ae753655-975c-481b-af1e-32adfca31fd5	erledigt	\N	\N	2026-02-20 23:23:00.193812+00
8576e532-cd13-458e-a59e-da973d0300ee	9ac39b85-efad-4f33-867b-605fdfea1b9d	ae753655-975c-481b-af1e-32adfca31fd5	erledigt	\N	\N	2026-02-20 23:23:38.765196+00
af6fdc73-9585-4836-af77-c609a23e047d	9ddb68cb-1c3a-4ac7-a148-068b1b4192d8	ae753655-975c-481b-af1e-32adfca31fd5	erledigt	\N	\N	2026-02-20 23:24:02.498608+00
60fde1e5-9b8d-40f0-9fa6-85035308dc20	9ddb68cb-1c3a-4ac7-a148-068b1b4192d8	907f8218-3086-4432-9574-1b6a390d215b	erledigt	\N	\N	2026-02-22 13:57:09.862851+00
9c5050d4-e4d1-41b7-9869-5febed577876	9ac39b85-efad-4f33-867b-605fdfea1b9d	907f8218-3086-4432-9574-1b6a390d215b	erledigt	\N	\N	2026-02-22 13:57:25.558333+00
fc1f4217-b0ee-4202-9131-3927a9ce289e	3aafe10d-2a60-4d96-9f4a-f0abd001ebbc	907f8218-3086-4432-9574-1b6a390d215b	erledigt	\N	\N	2026-02-22 13:57:51.327357+00
eb3cb328-14e6-4c43-9836-a4ba76568196	72f4c8bf-cdbb-4709-8ae8-b3bc9975eccc	907f8218-3086-4432-9574-1b6a390d215b	erledigt	\N	\N	2026-02-22 13:57:35.278661+00
\.


--
-- Data for Name: shifts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shifts (id, event_name, date, start_time, end_time, location, notes, created_by, created_at, required_slots) FROM stdin;
9ddb68cb-1c3a-4ac7-a148-068b1b4192d8	Karnevalsparty – 15:30–16:30	2026-02-20	15:30:00	16:30:00	Aula	\N	\N	2026-02-19 14:57:40.054268+00	8
9ac39b85-efad-4f33-867b-605fdfea1b9d	Karnevalsparty – 16:30–17:30	2026-02-20	16:30:00	17:30:00	Aula	\N	\N	2026-02-19 14:57:40.203706+00	8
72f4c8bf-cdbb-4709-8ae8-b3bc9975eccc	Karnevalsparty – 17:30–18:30	2026-02-20	17:30:00	18:30:00	Aula	\N	\N	2026-02-19 14:57:40.390228+00	8
3aafe10d-2a60-4d96-9f4a-f0abd001ebbc	Karnevalsparty - 14:30-15:30	2026-02-20	14:30:00	15:30:00	Aula	\N	\N	2026-02-19 14:57:39.748646+00	8
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, title, description, committee_id, owner_id, due_at, status, proof_required, proof_url, access_token, created_at, updated_at, created_by) FROM stdin;
\.


--
-- Data for Name: treasury_updates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.treasury_updates (id, amount, source, updated_by, created_at) FROM stdin;
73d92af2-b8a9-4baf-a60e-ba2a7c33e929	6042.280000000001	Excel Upload	\N	2026-02-10 13:30:11.022441+00
dc93ff5d-746c-45fd-8573-0a90b3a3522e	6614.780000000001	Excel Upload	\N	2026-02-12 07:53:43.650477+00
5d310087-4853-41ac-86d1-ae83800d663d	6614.780000000001	Excel Upload	\N	2026-02-22 13:50:33.636111+00
7be32ebe-7c11-4ea2-a504-89e28d6176ce	7519.37	Excel Upload	\N	2026-02-22 13:53:05.707995+00
\.


--
-- Data for Name: user_counters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_counters (user_id, load_index, responsibility_malus, updated_at) FROM stdin;
0100e980-5d63-4dde-bdd1-49a049bef21e	1	0	2026-02-17 10:19:17.450089+00
896e664e-b5e5-435c-9ed7-bdc7ffa9c96c	4	2	2026-02-17 11:37:58.244147+00
2acd81dc-9e33-4b30-97cf-9c822f8009e6	3	0	2026-02-17 17:10:08.439593+00
d0315046-f60a-4f1a-a181-d8d6119b421a	4	2	2026-02-17 17:12:42.122953+00
1af16130-366f-4b4f-8076-7fca77da4b66	2	2	2026-02-20 23:11:14.866526+00
0451673c-60d8-4b08-8193-3adc46a549a8	1	0	2026-02-20 23:11:24.795294+00
3793d0d4-c471-4b87-bf07-827e5a67a3c4	2	2	2026-02-20 23:11:33.502046+00
d38bbea6-2e50-4df6-817f-ad5d86848f85	3	2	2026-02-20 23:11:37.265836+00
ee0cc14f-3426-4384-b32b-7a00169cf4d2	1	0	2026-02-20 23:11:50.003566+00
a9438f32-a5ac-4b94-a095-d06b6868e175	3	2	2026-02-20 23:12:01.362273+00
5a0cce79-d26c-4e3f-ba5b-46021ac5b890	2	2	2026-02-20 23:12:17.883111+00
45d8f8ee-0b52-4d2c-a068-cda116b0e586	1	0	2026-02-20 23:12:32.039127+00
28b5b4a3-0664-42a9-930b-6d01267b0a22	1	0	2026-02-20 23:12:34.26507+00
a1895e74-3246-4fe7-9fdc-92c2948aaeff	2	0	2026-02-20 23:12:36.646469+00
447af2c6-92b5-4f03-b4b5-7daabe3c31c8	3	2	2026-02-20 23:12:41.913+00
e6b3dc9b-b519-49b0-806f-c046db6bdae7	2	2	2026-02-20 23:12:50.530795+00
6049cadd-55d3-404d-9cd2-f2459cf11025	1	0	2026-02-20 23:13:18.669633+00
8d3130a7-59f2-44d2-94c6-1d475c6d9206	2	0	2026-02-20 23:15:03.442581+00
aae21dd6-8a37-4a44-aa72-961c91ccc9bb	5	4	2026-02-20 23:15:26.172068+00
fd148e93-0793-4394-a1a9-7782d6002404	1	0	2026-02-20 23:15:29.119391+00
ebfc8bab-f7f1-408c-9906-33360ff16352	2	2	2026-02-20 23:15:32.83666+00
26cca66b-02e0-430e-81b2-64b17f4b1167	1	0	2026-02-20 23:15:35.180604+00
a41d6ab1-9025-4181-bec7-e707d794420c	3	2	2026-02-20 23:15:37.047854+00
98b53fa0-2ca3-4001-8ad9-5180158ecd20	1	0	2026-02-20 23:15:45.927158+00
f840c063-79b6-4796-ab93-0352c789621b	5	4	2026-02-20 23:15:50.647419+00
fe64278a-c760-4945-bdc7-eb94d7e0bb79	6	6	2026-02-20 23:15:52.739586+00
9086573c-3165-4ca1-98f5-0ee63d166a51	2	0	2026-02-20 23:17:21.119183+00
21e2920a-e09c-4142-a3df-fe2ea1b14ba1	1	0	2026-02-20 23:17:23.03451+00
df8dbdbe-bf23-4f19-b168-f5eed5fb2166	1	0	2026-02-20 23:17:24.91371+00
57642b40-f142-4630-bab0-e798318d4d6b	1	0	2026-02-20 23:17:26.561918+00
d4044703-c597-4577-ab1f-f0b12096a8d1	2	0	2026-02-20 23:17:28.12279+00
ecdb1373-7081-4118-826d-93841fe544db	1	0	2026-02-20 23:17:29.829661+00
59398199-9c7a-4281-b572-a2a9fcd83b27	1	0	2026-02-20 23:17:31.297279+00
95ee11d0-717c-484d-b1b5-280f728566e2	1	0	2026-02-20 23:17:32.821011+00
70d84a7b-8609-44fd-aa06-e70bc186a8aa	5	0	2026-02-20 23:17:34.365355+00
7416ecdf-8e2f-4ba1-b4dc-bce1732d465c	2	0	2026-02-20 23:17:54.864654+00
e9797fb7-1cf3-45f9-aeff-0ab875fbcb9e	2	0	2026-02-20 23:17:56.644077+00
ae3d19d8-cb2e-4705-ae63-eb07d2db2b44	4	0	2026-02-20 23:18:55.62375+00
4eda936c-af7b-4c63-9f15-1e4bf99e235b	4	0	2026-02-20 23:21:32.105305+00
ae753655-975c-481b-af1e-32adfca31fd5	4	0	2026-02-20 23:24:04.948697+00
907f8218-3086-4432-9574-1b6a390d215b	3	0	2026-02-22 13:58:03.313277+00
\.


--
-- Name: committee_stats committee_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.committee_stats
    ADD CONSTRAINT committee_stats_pkey PRIMARY KEY (committee_id);


--
-- Name: committees committees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.committees
    ADD CONSTRAINT committees_pkey PRIMARY KEY (id);


--
-- Name: engagement_events engagement_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.engagement_events
    ADD CONSTRAINT engagement_events_pkey PRIMARY KEY (id);


--
-- Name: engagement_scores engagement_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.engagement_scores
    ADD CONSTRAINT engagement_scores_pkey PRIMARY KEY (user_id);


--
-- Name: material_procurement_participants material_procurement_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_procurement_participants
    ADD CONSTRAINT material_procurement_participants_pkey PRIMARY KEY (material_id, user_id);


--
-- Name: material_procurements material_procurements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_procurements
    ADD CONSTRAINT material_procurements_pkey PRIMARY KEY (id);


--
-- Name: profile_committees profile_committees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile_committees
    ADD CONSTRAINT profile_committees_pkey PRIMARY KEY (user_id, committee_id);


--
-- Name: profiles profiles_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: score_events score_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.score_events
    ADD CONSTRAINT score_events_pkey PRIMARY KEY (id);


--
-- Name: shift_assignments shift_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift_assignments
    ADD CONSTRAINT shift_assignments_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_access_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_access_token_key UNIQUE (access_token);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: treasury_updates treasury_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.treasury_updates
    ADD CONSTRAINT treasury_updates_pkey PRIMARY KEY (id);


--
-- Name: user_counters user_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_counters
    ADD CONSTRAINT user_counters_pkey PRIMARY KEY (user_id);


--
-- Name: idx_mpp_material_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mpp_material_id ON public.material_procurement_participants USING btree (material_id);


--
-- Name: idx_mpp_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mpp_user_id ON public.material_procurement_participants USING btree (user_id);


--
-- Name: idx_profile_committees_committee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profile_committees_committee_id ON public.profile_committees USING btree (committee_id);


--
-- Name: engagement_events trg_engagement_events_sync; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_engagement_events_sync AFTER INSERT OR DELETE OR UPDATE ON public.engagement_events FOR EACH ROW EXECUTE FUNCTION public.handle_engagement_events_sync();


--
-- Name: profiles trg_ensure_user_counters_on_profile; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_ensure_user_counters_on_profile AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.ensure_user_counters_on_profile_insert();


--
-- Name: shift_assignments trg_shift_engagement; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_shift_engagement AFTER UPDATE ON public.shift_assignments FOR EACH ROW EXECUTE FUNCTION public.handle_shift_engagement();


--
-- Name: shift_assignments trg_shift_score_events; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_shift_score_events AFTER UPDATE ON public.shift_assignments FOR EACH ROW EXECUTE FUNCTION public.handle_shift_score_events();


--
-- Name: profiles trg_sync_auth_ban_with_profile_role; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_auth_ban_with_profile_role AFTER INSERT OR UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_auth_ban_with_profile_role();


--
-- Name: score_events trg_sync_user_counters_on_score_event; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_user_counters_on_score_event AFTER INSERT ON public.score_events FOR EACH ROW EXECUTE FUNCTION public.sync_user_counters_from_score_event();


--
-- Name: score_events trg_sync_user_counters_on_score_event_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_user_counters_on_score_event_delete AFTER DELETE ON public.score_events FOR EACH ROW EXECUTE FUNCTION public.sync_user_counters_on_score_event_delete();


--
-- Name: tasks trg_task_engagement; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_task_engagement AFTER UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.handle_task_engagement();


--
-- Name: tasks trg_task_score_events; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_task_score_events AFTER UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.handle_task_score_events();


--
-- Name: tasks trg_tasks_recompute_committee_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_tasks_recompute_committee_stats AFTER INSERT OR DELETE OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_committee_stats();


--
-- Name: tasks trg_tasks_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_tasks_set_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_tasks_updated_at();


--
-- Name: committee_stats committee_stats_committee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.committee_stats
    ADD CONSTRAINT committee_stats_committee_id_fkey FOREIGN KEY (committee_id) REFERENCES public.committees(id);


--
-- Name: engagement_events engagement_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.engagement_events
    ADD CONSTRAINT engagement_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: engagement_scores engagement_scores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.engagement_scores
    ADD CONSTRAINT engagement_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: material_procurement_participants material_procurement_participants_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_procurement_participants
    ADD CONSTRAINT material_procurement_participants_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.material_procurements(id) ON DELETE CASCADE;


--
-- Name: material_procurement_participants material_procurement_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_procurement_participants
    ADD CONSTRAINT material_procurement_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: material_procurements material_procurements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_procurements
    ADD CONSTRAINT material_procurements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: material_procurements material_procurements_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.material_procurements
    ADD CONSTRAINT material_procurements_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.profiles(id);


--
-- Name: profile_committees profile_committees_committee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile_committees
    ADD CONSTRAINT profile_committees_committee_id_fkey FOREIGN KEY (committee_id) REFERENCES public.committees(id) ON DELETE CASCADE;


--
-- Name: profile_committees profile_committees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile_committees
    ADD CONSTRAINT profile_committees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_committee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_committee_id_fkey FOREIGN KEY (committee_id) REFERENCES public.committees(id);


--
-- Name: score_events score_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.score_events
    ADD CONSTRAINT score_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: shift_assignments shift_assignments_replacement_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift_assignments
    ADD CONSTRAINT shift_assignments_replacement_user_id_fkey FOREIGN KEY (replacement_user_id) REFERENCES public.profiles(id);


--
-- Name: shift_assignments shift_assignments_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift_assignments
    ADD CONSTRAINT shift_assignments_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: shift_assignments shift_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift_assignments
    ADD CONSTRAINT shift_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: shifts shifts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: tasks tasks_committee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_committee_id_fkey FOREIGN KEY (committee_id) REFERENCES public.committees(id);


--
-- Name: tasks tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: tasks tasks_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);


--
-- Name: treasury_updates treasury_updates_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.treasury_updates
    ADD CONSTRAINT treasury_updates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: user_counters user_counters_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_counters
    ADD CONSTRAINT user_counters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: committee_stats; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.committee_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: committee_stats committee_stats_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY committee_stats_admin_write ON public.committee_stats USING ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role]))) WITH CHECK ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role])));


--
-- Name: committee_stats committee_stats_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY committee_stats_public_read ON public.committee_stats FOR SELECT USING (true);


--
-- Name: committees; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.committees ENABLE ROW LEVEL SECURITY;

--
-- Name: committees committees_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY committees_admin_write ON public.committees USING ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role]))) WITH CHECK ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role])));


--
-- Name: committees committees_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY committees_read_all ON public.committees FOR SELECT USING (true);


--
-- Name: engagement_events engagement_admin_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY engagement_admin_read ON public.engagement_events FOR SELECT USING ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role])));


--
-- Name: engagement_events engagement_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY engagement_admin_write ON public.engagement_events USING ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role]))) WITH CHECK ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role])));


--
-- Name: engagement_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.engagement_events ENABLE ROW LEVEL SECURITY;

--
-- Name: engagement_scores; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.engagement_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: engagement_scores engagement_scores_read_admin_lead; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY engagement_scores_read_admin_lead ON public.engagement_scores FOR SELECT USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::public.role, 'lead'::public.role])))))));


--
-- Name: material_procurement_participants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.material_procurement_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: material_procurements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.material_procurements ENABLE ROW LEVEL SECURITY;

--
-- Name: material_procurements material_procurements_insert_admin_lead; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY material_procurements_insert_admin_lead ON public.material_procurements FOR INSERT WITH CHECK ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role])));


--
-- Name: material_procurements material_procurements_read_admin_lead; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY material_procurements_read_admin_lead ON public.material_procurements FOR SELECT USING ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role])));


--
-- Name: material_procurement_participants mpp_insert_admin_lead; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY mpp_insert_admin_lead ON public.material_procurement_participants FOR INSERT WITH CHECK ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role])));


--
-- Name: material_procurement_participants mpp_read_admin_lead; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY mpp_read_admin_lead ON public.material_procurement_participants FOR SELECT USING ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role])));


--
-- Name: profile_committees; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profile_committees ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_committees profile_committees_admin_lead_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profile_committees_admin_lead_write ON public.profile_committees USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::public.role, 'lead'::public.role])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::public.role, 'lead'::public.role]))))));


--
-- Name: profile_committees profile_committees_read_admin_lead_self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profile_committees_read_admin_lead_self ON public.profile_committees FOR SELECT USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::public.role, 'lead'::public.role])))))));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_admin_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_admin_update ON public.profiles USING ((public.current_profile_role() = 'admin'::public.role)) WITH CHECK ((public.current_profile_role() = 'admin'::public.role));


--
-- Name: profiles profiles_self_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_self_select ON public.profiles FOR SELECT USING (((auth_user_id = auth.uid()) OR (public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role]))));


--
-- Name: shift_assignments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_assignments shift_assignments_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY shift_assignments_admin_write ON public.shift_assignments USING ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role]))) WITH CHECK ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role])));


--
-- Name: shift_assignments shift_assignments_read_self_or_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY shift_assignments_read_self_or_admin ON public.shift_assignments FOR SELECT USING (((user_id = public.current_profile_id()) OR (public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role]))));


--
-- Name: shifts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts shifts_admin_lead_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY shifts_admin_lead_write ON public.shifts USING ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role]))) WITH CHECK ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role])));


--
-- Name: shifts shifts_read_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY shifts_read_all ON public.shifts FOR SELECT USING (true);


--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks tasks_admin_lead_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tasks_admin_lead_read ON public.tasks FOR SELECT USING ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role])));


--
-- Name: tasks tasks_admin_lead_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tasks_admin_lead_write ON public.tasks USING ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role]))) WITH CHECK ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role])));


--
-- Name: treasury_updates treasury_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY treasury_admin_write ON public.treasury_updates USING ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role]))) WITH CHECK ((public.current_profile_role() = ANY (ARRAY['admin'::public.role, 'lead'::public.role])));


--
-- Name: treasury_updates treasury_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY treasury_public_read ON public.treasury_updates FOR SELECT USING (true);


--
-- Name: treasury_updates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.treasury_updates ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION apply_task_missed_penalties(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.apply_task_missed_penalties() TO anon;
GRANT ALL ON FUNCTION public.apply_task_missed_penalties() TO authenticated;
GRANT ALL ON FUNCTION public.apply_task_missed_penalties() TO service_role;


--
-- Name: FUNCTION check_financial_target(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_financial_target() TO anon;
GRANT ALL ON FUNCTION public.check_financial_target() TO authenticated;
GRANT ALL ON FUNCTION public.check_financial_target() TO service_role;


--
-- Name: FUNCTION current_profile_id(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.current_profile_id() TO anon;
GRANT ALL ON FUNCTION public.current_profile_id() TO authenticated;
GRANT ALL ON FUNCTION public.current_profile_id() TO service_role;


--
-- Name: FUNCTION current_profile_role(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.current_profile_role() TO anon;
GRANT ALL ON FUNCTION public.current_profile_role() TO authenticated;
GRANT ALL ON FUNCTION public.current_profile_role() TO service_role;


--
-- Name: FUNCTION ensure_user_counters_on_profile_insert(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.ensure_user_counters_on_profile_insert() TO anon;
GRANT ALL ON FUNCTION public.ensure_user_counters_on_profile_insert() TO authenticated;
GRANT ALL ON FUNCTION public.ensure_user_counters_on_profile_insert() TO service_role;


--
-- Name: FUNCTION get_engagement_scores(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_engagement_scores() TO anon;
GRANT ALL ON FUNCTION public.get_engagement_scores() TO authenticated;
GRANT ALL ON FUNCTION public.get_engagement_scores() TO service_role;


--
-- Name: FUNCTION grant_lead_weekly_bonus(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.grant_lead_weekly_bonus() TO anon;
GRANT ALL ON FUNCTION public.grant_lead_weekly_bonus() TO authenticated;
GRANT ALL ON FUNCTION public.grant_lead_weekly_bonus() TO service_role;


--
-- Name: FUNCTION handle_engagement_events_sync(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_engagement_events_sync() TO anon;
GRANT ALL ON FUNCTION public.handle_engagement_events_sync() TO authenticated;
GRANT ALL ON FUNCTION public.handle_engagement_events_sync() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION handle_shift_engagement(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_shift_engagement() TO anon;
GRANT ALL ON FUNCTION public.handle_shift_engagement() TO authenticated;
GRANT ALL ON FUNCTION public.handle_shift_engagement() TO service_role;


--
-- Name: FUNCTION handle_shift_score_events(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_shift_score_events() TO anon;
GRANT ALL ON FUNCTION public.handle_shift_score_events() TO authenticated;
GRANT ALL ON FUNCTION public.handle_shift_score_events() TO service_role;


--
-- Name: FUNCTION handle_task_engagement(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_task_engagement() TO anon;
GRANT ALL ON FUNCTION public.handle_task_engagement() TO authenticated;
GRANT ALL ON FUNCTION public.handle_task_engagement() TO service_role;


--
-- Name: FUNCTION handle_task_score_events(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_task_score_events() TO anon;
GRANT ALL ON FUNCTION public.handle_task_score_events() TO authenticated;
GRANT ALL ON FUNCTION public.handle_task_score_events() TO service_role;


--
-- Name: FUNCTION recompute_committee_stats(p_committee_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.recompute_committee_stats(p_committee_id uuid) TO anon;
GRANT ALL ON FUNCTION public.recompute_committee_stats(p_committee_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recompute_committee_stats(p_committee_id uuid) TO service_role;


--
-- Name: FUNCTION refresh_engagement_score(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.refresh_engagement_score(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.refresh_engagement_score(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.refresh_engagement_score(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION set_tasks_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_tasks_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_tasks_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_tasks_updated_at() TO service_role;


--
-- Name: FUNCTION sync_auth_ban_with_profile_role(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_auth_ban_with_profile_role() TO anon;
GRANT ALL ON FUNCTION public.sync_auth_ban_with_profile_role() TO authenticated;
GRANT ALL ON FUNCTION public.sync_auth_ban_with_profile_role() TO service_role;


--
-- Name: FUNCTION sync_user_counters_from_score_event(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_user_counters_from_score_event() TO anon;
GRANT ALL ON FUNCTION public.sync_user_counters_from_score_event() TO authenticated;
GRANT ALL ON FUNCTION public.sync_user_counters_from_score_event() TO service_role;


--
-- Name: FUNCTION sync_user_counters_on_score_event_delete(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_user_counters_on_score_event_delete() TO anon;
GRANT ALL ON FUNCTION public.sync_user_counters_on_score_event_delete() TO authenticated;
GRANT ALL ON FUNCTION public.sync_user_counters_on_score_event_delete() TO service_role;


--
-- Name: FUNCTION trg_recompute_committee_stats(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trg_recompute_committee_stats() TO anon;
GRANT ALL ON FUNCTION public.trg_recompute_committee_stats() TO authenticated;
GRANT ALL ON FUNCTION public.trg_recompute_committee_stats() TO service_role;


--
-- Name: TABLE committee_stats; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.committee_stats TO anon;
GRANT ALL ON TABLE public.committee_stats TO authenticated;
GRANT ALL ON TABLE public.committee_stats TO service_role;


--
-- Name: TABLE committees; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.committees TO anon;
GRANT ALL ON TABLE public.committees TO authenticated;
GRANT ALL ON TABLE public.committees TO service_role;


--
-- Name: TABLE engagement_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.engagement_events TO anon;
GRANT ALL ON TABLE public.engagement_events TO authenticated;
GRANT ALL ON TABLE public.engagement_events TO service_role;


--
-- Name: TABLE engagement_scores; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.engagement_scores TO anon;
GRANT ALL ON TABLE public.engagement_scores TO authenticated;
GRANT ALL ON TABLE public.engagement_scores TO service_role;


--
-- Name: TABLE material_procurement_participants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.material_procurement_participants TO anon;
GRANT ALL ON TABLE public.material_procurement_participants TO authenticated;
GRANT ALL ON TABLE public.material_procurement_participants TO service_role;


--
-- Name: TABLE material_procurements; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.material_procurements TO anon;
GRANT ALL ON TABLE public.material_procurements TO authenticated;
GRANT ALL ON TABLE public.material_procurements TO service_role;


--
-- Name: TABLE profile_committees; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profile_committees TO anon;
GRANT ALL ON TABLE public.profile_committees TO authenticated;
GRANT ALL ON TABLE public.profile_committees TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE score_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.score_events TO anon;
GRANT ALL ON TABLE public.score_events TO authenticated;
GRANT ALL ON TABLE public.score_events TO service_role;


--
-- Name: TABLE shift_assignments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.shift_assignments TO anon;
GRANT ALL ON TABLE public.shift_assignments TO authenticated;
GRANT ALL ON TABLE public.shift_assignments TO service_role;


--
-- Name: TABLE shifts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.shifts TO anon;
GRANT ALL ON TABLE public.shifts TO authenticated;
GRANT ALL ON TABLE public.shifts TO service_role;


--
-- Name: TABLE tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tasks TO anon;
GRANT ALL ON TABLE public.tasks TO authenticated;
GRANT ALL ON TABLE public.tasks TO service_role;


--
-- Name: TABLE treasury_updates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.treasury_updates TO anon;
GRANT ALL ON TABLE public.treasury_updates TO authenticated;
GRANT ALL ON TABLE public.treasury_updates TO service_role;


--
-- Name: TABLE user_counters; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_counters TO anon;
GRANT ALL ON TABLE public.user_counters TO authenticated;
GRANT ALL ON TABLE public.user_counters TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict bWhy2bzRqXJgdxnYGPwaghXdbSBHU97rTi4Y0JR97i27zCQNnD5aB9INjwcEcYi

