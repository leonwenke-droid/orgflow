-- Add owner and viewer roles for expanded permission model
-- owner = full org control, viewer = read only
-- Existing: admin, lead, member. lead = TeamLead in UI.

do $$
begin
  if exists (select 1 from pg_type where typname = 'role') then
    begin
      alter type public.role add value 'owner';
    exception when duplicate_object then null;
    end;
    begin
      alter type public.role add value 'viewer';
    exception when duplicate_object then null;
    end;
  end if;
end
$$;
