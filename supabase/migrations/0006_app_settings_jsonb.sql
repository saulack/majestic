alter table app_settings
  alter column value type jsonb
  using to_jsonb(value);

insert into app_settings (key, value)
values ('homepage_reservations_count', to_jsonb(5))
on conflict (key) do nothing;
