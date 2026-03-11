-- Schicht-Engagement-Scores mit neuer Logik neu berechnen:
-- erledigt → +10 für Zugewiesenen
-- abgesagt + Ersatz → nur Ersatz bekommt +10, Original nichts
-- abgesagt ohne Ersatz → -15 für Zugewiesenen

-- 1) Alte Schicht-Events entfernen (shift_done, shift_missed, replacement_arranged mit source_id = assignment)
delete from engagement_events
where event_type in ('shift_done', 'shift_missed', 'replacement_arranged')
  and source_id in (select id from shift_assignments);

-- 2) Nach neuer Logik neu einfügen
-- erledigt: Zugewiesener bekommt +10
insert into engagement_events (user_id, event_type, points, source_id)
select user_id, 'shift_done', 10, id
from shift_assignments
where status = 'erledigt' and user_id is not null;

-- abgesagt mit Ersatz: Nur Ersatz bekommt +10 (Original nichts)
insert into engagement_events (user_id, event_type, points, source_id)
select replacement_user_id, 'shift_done', 10, id
from shift_assignments
where status = 'abgesagt' and replacement_user_id is not null;

-- abgesagt ohne Ersatz: Zugewiesener bekommt -15
insert into engagement_events (user_id, event_type, points, source_id)
select user_id, 'shift_missed', -15, id
from shift_assignments
where status = 'abgesagt' and replacement_user_id is null and user_id is not null;
