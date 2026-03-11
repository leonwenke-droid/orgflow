-- Organisationsnamen ohne führende/nachfolgende Leerzeichen in der DB speichern.
update public.organizations
set name = trim(name)
where name is not null and name <> trim(name);
