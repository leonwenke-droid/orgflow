-- Neutrale Standard-Komitees (mehrfach ausführbar; für neue Organisationen)
insert into committees (name)
select name from (values
  ('Veranstaltungskomitee'),
  ('Redaktion'),
  ('Finanzkomitee'),
  ('Hauptveranstaltung'),
  ('Social Media'),
  ('Aktionen'),
  ('Logistik')
) as t(name)
where not exists (select 1 from committees c where c.name = t.name);
