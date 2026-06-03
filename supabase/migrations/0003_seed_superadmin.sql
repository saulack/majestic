insert into role_grants (email, role)
values ('saulack@gmail.com', 'superadmin')
on conflict (email) do update
set role = excluded.role;
