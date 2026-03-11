-- Beim Löschen einer Organisation werden Profile gelöscht; dabei werden engagement_events
-- (CASCADE) gelöscht. Der Trigger trg_engagement_events_sync ruft refresh_engagement_score
-- auf – und versucht, engagement_scores für einen User zu aktualisieren, dessen Profil
-- gerade gelöscht wird → FK-Verletzung. Wenn das Profil nicht mehr existiert, nichts tun
-- (die engagement_scores-Zeile wird mit dem Profil per CASCADE gelöscht).

create or replace function public.refresh_engagement_score(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if not exists (select 1 from public.profiles where id = p_user_id limit 1) then
    return;
  end if;

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
