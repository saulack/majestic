create table if not exists maintenance_threshold_approvals (
  id uuid primary key default gen_random_uuid(),
  maintenance_type_id uuid not null references maintenance_types(id) on delete cascade,
  proposed_threshold_days integer not null check (proposed_threshold_days >= 1),
  requested_by uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists maintenance_threshold_approvals_status_idx
  on maintenance_threshold_approvals (status, created_at desc);

create unique index if not exists maintenance_threshold_pending_unique
  on maintenance_threshold_approvals (maintenance_type_id, requested_by)
  where status = 'pending';

alter table maintenance_threshold_approvals enable row level security;

create policy "maintenance threshold approvals readable by authenticated users"
on maintenance_threshold_approvals for select
using (auth.role() = 'authenticated');

create policy "authenticated users can create maintenance threshold approvals"
on maintenance_threshold_approvals for insert
with check (auth.role() = 'authenticated' and auth.uid() = requested_by);

create policy "superadmin can update maintenance threshold approvals"
on maintenance_threshold_approvals for update
using (public.current_role() = 'superadmin')
with check (public.current_role() = 'superadmin');
