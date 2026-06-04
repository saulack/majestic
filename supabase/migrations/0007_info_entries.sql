create table if not exists info_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  number text not null default '',
  email text not null default '',
  address text not null default '',
  role_function text not null,
  is_staff boolean not null default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists info_access_codes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  passcode text not null,
  location text not null default '',
  notes text not null default '',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists info_emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  name text not null,
  phone_number text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists info_checkout_items (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  done boolean not null default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table info_contacts enable row level security;
alter table info_access_codes enable row level security;
alter table info_emergency_contacts enable row level security;
alter table info_checkout_items enable row level security;

create policy "authenticated can read info contacts"
on info_contacts for select
using (auth.role() = 'authenticated');

create policy "authenticated can insert info contacts"
on info_contacts for insert
with check (auth.role() = 'authenticated');

create policy "authenticated can update info contacts"
on info_contacts for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "authenticated can delete info contacts"
on info_contacts for delete
using (auth.role() = 'authenticated');

create policy "authenticated can read info access codes"
on info_access_codes for select
using (auth.role() = 'authenticated');

create policy "authenticated can insert info access codes"
on info_access_codes for insert
with check (auth.role() = 'authenticated');

create policy "authenticated can update info access codes"
on info_access_codes for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "authenticated can delete info access codes"
on info_access_codes for delete
using (auth.role() = 'authenticated');

create policy "authenticated can read info emergency contacts"
on info_emergency_contacts for select
using (auth.role() = 'authenticated');

create policy "authenticated can insert info emergency contacts"
on info_emergency_contacts for insert
with check (auth.role() = 'authenticated');

create policy "authenticated can update info emergency contacts"
on info_emergency_contacts for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "authenticated can delete info emergency contacts"
on info_emergency_contacts for delete
using (auth.role() = 'authenticated');

create policy "authenticated can read info checkout items"
on info_checkout_items for select
using (auth.role() = 'authenticated');

create policy "authenticated can insert info checkout items"
on info_checkout_items for insert
with check (auth.role() = 'authenticated');

create policy "authenticated can update info checkout items"
on info_checkout_items for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "authenticated can delete info checkout items"
on info_checkout_items for delete
using (auth.role() = 'authenticated');
