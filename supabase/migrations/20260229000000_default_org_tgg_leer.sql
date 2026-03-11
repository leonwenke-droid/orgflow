-- ============================================================================
-- Default-Organisation auf Teletta-Groß-Gymnasium Leer (TGG) umstellen
-- Alle bestehenden Daten (Profile, Tasks, Shifts, etc.) bleiben der gleichen
-- Org zugeordnet; nur Name, Slug und Schuldaten werden angepasst.
-- ============================================================================

update organizations
set
  name = 'Abitur 2026 - Teletta-Groß-Gymnasium Leer',
  slug = 'abi-2026-tgg',
  subdomain = 'tgg-2026',
  school_name = 'Teletta-Groß-Gymnasium',
  school_short = 'TGG',
  school_city = 'Leer',
  year = 2026,
  is_active = true,
  updated_at = now()
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
