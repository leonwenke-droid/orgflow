-- Komitees für ABI ORGA 2026 (mehrfach ausführbar)
insert into committees (name)
select name from (values
  ('Veranstaltungskomitee'),
  ('Abibuch'),
  ('Finanzkomitee'),
  ('Abiball'),
  ('Socialmedia'),
  ('Mottowoche'),
  ('Abistreich')
) as t(name)
where not exists (select 1 from committees c where c.name = t.name);
