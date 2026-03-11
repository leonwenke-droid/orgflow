-- Tasks can have committee_id = null (e.g. "Gesamter Jahrgang").
-- Only recompute committee_stats when the task has a committee_id.

create or replace function trg_recompute_committee_stats()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    if new.committee_id is not null then
      perform recompute_committee_stats(new.committee_id);
    end if;
  elsif (tg_op = 'UPDATE') then
    if old.committee_id is not null then
      perform recompute_committee_stats(old.committee_id);
    end if;
    if new.committee_id is not null then
      perform recompute_committee_stats(new.committee_id);
    end if;
  elsif (tg_op = 'DELETE') then
    if old.committee_id is not null then
      perform recompute_committee_stats(old.committee_id);
    end if;
  end if;
  return null;
end;
$$ language plpgsql;
