-- Public bucket for org logos (uploadOrgLogoAction uses bucket id "public").

insert into storage.buckets (id, name, public)
values ('public', 'public', true)
on conflict (id) do nothing;
