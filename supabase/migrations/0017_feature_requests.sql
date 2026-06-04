create table if not exists feature_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 120),
  description text not null check (char_length(trim(description)) between 10 and 4000),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'declined', 'completed', 'rejected')),
  status_email_opt_in boolean not null default false,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feature_requests_requested_by_idx
  on feature_requests (requested_by, created_at desc);

create index if not exists feature_requests_status_idx
  on feature_requests (status, updated_at desc);

alter table feature_requests enable row level security;

create policy "feature requests readable by authenticated users"
on feature_requests for select
using (
  auth.role() = 'authenticated'
  and (auth.uid() = requested_by or public.current_role() = 'superadmin')
);

create policy "authenticated users can create own feature requests"
on feature_requests for insert
with check (auth.role() = 'authenticated' and auth.uid() = requested_by);

create policy "superadmin can update feature requests"
on feature_requests for update
using (public.current_role() = 'superadmin')
with check (public.current_role() = 'superadmin');
