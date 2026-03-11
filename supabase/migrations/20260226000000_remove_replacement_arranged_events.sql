-- replacement_arranged-Punkte entfernen: Wer Ersatz besorgt hat bekommt nichts.
-- Der Ersatz behält seine shift_done-Punkte.
delete from engagement_events where event_type = 'replacement_arranged';
