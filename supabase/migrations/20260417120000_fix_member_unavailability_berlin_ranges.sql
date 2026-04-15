-- Legacy app stored YYYY-MM-DD as UTC noon → end-of-UTC-day, so Berlin "same day" absences
-- missed morning shifts. New rows use full Europe/Berlin calendar days (see lib/berlinCalendarRange.ts).
-- Rewrites only rows that match the old generator (UTC 12:00 start, late UTC end).

-- Single UTC calendar day (typical one-day request)
update public.member_unavailability u
set
  unavailable_from = (
    date_trunc('day', u.unavailable_from at time zone 'Europe/Berlin') at time zone 'Europe/Berlin'
  ),
  unavailable_until = (
    (date_trunc('day', u.unavailable_from at time zone 'Europe/Berlin') + interval '1 day')
    at time zone 'Europe/Berlin'
  )
where
  (u.unavailable_from at time zone 'UTC')::date = (u.unavailable_until at time zone 'UTC')::date
  and (u.unavailable_from at time zone 'UTC')::time = time '12:00:00'
  and (u.unavailable_until at time zone 'UTC')::time >= time '23:59:00';

-- Multi-day range (first day noon UTC … last day 23:59 UTC)
update public.member_unavailability u
set
  unavailable_from = (
    date_trunc('day', u.unavailable_from at time zone 'Europe/Berlin') at time zone 'Europe/Berlin'
  ),
  unavailable_until = (
    (
      greatest(
        (u.unavailable_from at time zone 'Europe/Berlin')::date,
        (u.unavailable_until at time zone 'Europe/Berlin')::date
      ) + interval '1 day'
    )::timestamp at time zone 'Europe/Berlin'
  )
where
  (u.unavailable_from at time zone 'UTC')::date <> (u.unavailable_until at time zone 'UTC')::date
  and (u.unavailable_from at time zone 'UTC')::time = time '12:00:00'
  and (u.unavailable_until at time zone 'UTC')::time >= time '23:59:00';
