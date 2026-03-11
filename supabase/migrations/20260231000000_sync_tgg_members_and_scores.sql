-- ============================================================================
-- Sync: Alle Profile und Engagement-Scores der TGG-Org (abi-2026-tgg / abi2026-tgg) zuweisen
-- Einmal ausführen, damit Mitgliederliste und Engagementscores im Admin sichtbar sind.
-- ============================================================================

do $$
declare
  tgg_id uuid;
begin
  -- Org per Slug finden (mit und ohne Bindestrich)
  select id into tgg_id
  from public.organizations
  where is_active = true
    and (slug = 'abi-2026-tgg' or slug = 'abi2026-tgg')
  limit 1;

  if tgg_id is null then
    raise notice 'Keine aktive Organisation mit Slug abi-2026-tgg oder abi2026-tgg gefunden. Sync übersprungen.';
    return;
  end if;

  -- Alle Profile dieser Org zuweisen (Mitgliederliste = alle mit dieser organization_id)
  update public.profiles
  set organization_id = tgg_id
  where organization_id is distinct from tgg_id
     or organization_id is null;

  -- Engagement-Scores: organization_id aus Profil übernehmen (Backfill)
  update public.engagement_scores es
  set organization_id = tgg_id
  from public.profiles p
  where p.id = es.user_id
    and p.organization_id = tgg_id
    and (es.organization_id is distinct from tgg_id or es.organization_id is null);

  -- Scores ohne Profil-Zuordnung: user_id gehört jetzt zu TGG, also Score auch TGG
  update public.engagement_scores
  set organization_id = tgg_id
  where user_id in (select id from public.profiles where organization_id = tgg_id)
    and (organization_id is distinct from tgg_id or organization_id is null);

  raise notice 'TGG-Sync abgeschlossen. Org-ID: %. Profile und Engagement-Scores zugewiesen.', tgg_id;
end $$;
