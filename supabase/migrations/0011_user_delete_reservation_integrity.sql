alter table reservations
  alter column created_by drop not null;

alter table reservations
  drop constraint if exists reservations_created_by_fkey;

alter table reservations
  add constraint reservations_created_by_fkey
  foreign key (created_by)
  references profiles(id)
  on delete set null;

alter table reservations
  drop constraint if exists reservations_reviewed_by_fkey;

alter table reservations
  add constraint reservations_reviewed_by_fkey
  foreign key (reviewed_by)
  references profiles(id)
  on delete set null;
