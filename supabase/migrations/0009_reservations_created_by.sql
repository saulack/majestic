alter table reservations
  add column if not exists created_by uuid references profiles(id) on delete set null;

update reservations
set created_by = user_id
where created_by is null;

alter table reservations
  alter column created_by set not null;

drop policy if exists "users can insert own reservations" on reservations;

create policy "authenticated users can insert reservations"
on reservations for insert
with check (
  auth.role() = 'authenticated'
  and auth.uid() = created_by
);
