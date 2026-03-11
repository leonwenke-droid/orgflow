-- Auf- und Abbauphase: erste Schicht kann 30 Min. früher starten, letzte 30 Min. später enden.
-- Personen in solchen Schichten erhalten zusätzliche Engagement-Punkte (+5 pro Phase).
alter table shifts
  add column if not exists has_aufbau boolean not null default false,
  add column if not exists has_abbau boolean not null default false;

comment on column shifts.has_aufbau is 'Erste Schicht: 30 Min. Aufbau vor Start, +5 Engagement-Punkte';
comment on column shifts.has_abbau is 'Letzte Schicht: 30 Min. Abbau nach Ende, +5 Engagement-Punkte';
