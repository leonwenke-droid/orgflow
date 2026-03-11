-- lead_weekly (+5 Punkte) entfernen für alle, die kein berechtigter Lead sind.
-- Nach der vorherigen Migration haben nur noch die 10 richtigen Leads role='lead'.
delete from engagement_events
where event_type = 'lead_weekly'
  and user_id in (select id from profiles where role != 'lead');
