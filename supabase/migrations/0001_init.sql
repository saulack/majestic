create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint reservation_date_check check (end_date >= start_date)
);

create table if not exists notification_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table reservations enable row level security;
alter table notification_preferences enable row level security;

create policy "profiles are readable by authenticated users"
on profiles for select
using (auth.role() = 'authenticated');

create policy "users can update their profile"
on profiles for update
using (auth.uid() = id);

create policy "reservations readable by authenticated users"
on reservations for select
using (auth.role() = 'authenticated');

create policy "users can insert own reservations"
on reservations for insert
with check (auth.uid() = user_id);

create policy "users can update own reservations"
on reservations for update
using (auth.uid() = user_id);

create policy "users can delete own reservations"
on reservations for delete
using (auth.uid() = user_id);

create policy "users can manage own notification preferences"
on notification_preferences for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
