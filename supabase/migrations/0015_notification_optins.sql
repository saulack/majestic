alter table notification_preferences
  add column if not exists reservation_confirmation_email boolean not null default false;
