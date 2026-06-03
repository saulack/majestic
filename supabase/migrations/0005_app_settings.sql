create table if not exists app_settings (
  key text primary key,
  value boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

create policy "superadmin can manage app settings"
on app_settings for all
using (public.current_role() = 'superadmin')
with check (public.current_role() = 'superadmin');

insert into app_settings (key, value)
values ('reservation_approvals_enabled', false)
on conflict (key) do nothing;
