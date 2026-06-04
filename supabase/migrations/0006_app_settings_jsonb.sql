alter table app_settings
  alter column value drop default;

alter table app_settings
  alter column value type jsonb
  using to_jsonb(value);

alter table app_settings
  alter column value set default to_jsonb(false);

insert into app_settings (key, value)
values ('homepage_reservations_count', to_jsonb(5))
on conflict (key) do nothing;
