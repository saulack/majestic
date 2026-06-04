alter table reservations
  add column if not exists shared_with_user_ids uuid[] not null default '{}';

create index if not exists reservations_shared_with_user_ids_idx
  on reservations using gin (shared_with_user_ids);
