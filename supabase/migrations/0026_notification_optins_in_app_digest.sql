alter table notification_preferences
  add column if not exists in_app_inbox_digest_email boolean not null default false,
  add column if not exists in_app_inbox_digest_last_sent_at timestamptz;
