alter table notification_preferences
  add column if not exists reservation_booked_by_other_email boolean not null default false;
