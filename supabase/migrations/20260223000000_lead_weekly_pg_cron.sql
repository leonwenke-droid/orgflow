-- Wöchentlicher Lead-Bonus: Jeden Montag +5 Punkte für alle Leads.
-- Läuft vollständig in der Datenbank über pg_cron, keine API nötig.
-- pg_cron muss ggf. im Dashboard aktiviert sein (Integrations > Cron).

create extension if not exists pg_cron with schema extensions;

create or replace function grant_lead_weekly_bonus()
returns int
language plpgsql
security definer
set search_path = public
as $$
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

comment on function grant_lead_weekly_bonus is 'Fügt lead_weekly (+5 Punkte) für alle Leads hinzu, die diese Woche noch keinen haben. Idempotent.';

-- pg_cron: Jeden Montag um 06:00 UTC
select cron.schedule(
  'lead-weekly-bonus',
  '0 6 * * 1',
  'select grant_lead_weekly_bonus();'
);
