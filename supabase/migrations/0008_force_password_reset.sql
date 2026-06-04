alter table profiles
  add column if not exists force_password_reset boolean not null default false;
