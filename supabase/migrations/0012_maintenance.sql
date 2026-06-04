create table if not exists maintenance_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  threshold_days integer not null check (threshold_days >= 1),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists maintenance_records (
  id uuid primary key default gen_random_uuid(),
  maintenance_type_id uuid not null references maintenance_types(id) on delete cascade,
  scheduled_for date not null,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists maintenance_notifications (
  id uuid primary key default gen_random_uuid(),
  maintenance_type_id uuid not null references maintenance_types(id) on delete cascade,
  reservation_id uuid references reservations(id) on delete set null,
  notified_user_id uuid not null references profiles(id) on delete cascade,
  reservation_start_date date not null,
  reservation_end_date date not null,
  triggered_on date not null,
  created_at timestamptz not null default now(),
  unique (maintenance_type_id, notified_user_id, triggered_on, reservation_start_date, reservation_end_date)
);

alter table maintenance_types enable row level security;
alter table maintenance_records enable row level security;
alter table maintenance_notifications enable row level security;

create policy "maintenance types readable by authenticated users"
on maintenance_types for select
using (auth.role() = 'authenticated');

create policy "superadmin can manage maintenance types"
on maintenance_types for all
using (public.current_role() = 'superadmin')
with check (public.current_role() = 'superadmin');

create policy "maintenance records readable by authenticated users"
on maintenance_records for select
using (auth.role() = 'authenticated');

create policy "authenticated users can create maintenance records"
on maintenance_records for insert
with check (auth.role() = 'authenticated' and auth.uid() = created_by);

create policy "maintenance notifications readable by authenticated users"
on maintenance_notifications for select
using (auth.role() = 'authenticated');

insert into maintenance_types (name, threshold_days)
values
  ('Window cleaning', 30),
  ('Apartment cleaning', 7)
on conflict (name) do nothing;