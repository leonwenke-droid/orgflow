-- ============================================================================
-- engagement_scores: organization_id bei Sync setzen + Backfill
-- Damit Scores pro Jahrgang (Org) in Admin und Dashboard sichtbar sind.
-- ============================================================================

-- 1) Trigger-Funktion: organization_id aus Profil übernehmen
create or replace function public.refresh_engagement_score(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.profiles where id = p_user_id limit 1;

  insert into public.engagement_scores (user_id, score, updated_at, organization_id)
  select p_user_id, coalesce(sum(points), 0), now(), v_org_id
  from public.engagement_events
  where user_id = p_user_id
  on conflict (user_id) do update
  set score = excluded.score, updated_at = excluded.updated_at,
      organization_id = coalesce(engagement_scores.organization_id, excluded.organization_id);
end;
$$;

-- 2) Bestehende Zeilen: organization_id aus Profil setzen
update public.engagement_scores es
set organization_id = p.organization_id
from public.profiles p
where p.id = es.user_id
  and (es.organization_id is null or es.organization_id is distinct from p.organization_id);
