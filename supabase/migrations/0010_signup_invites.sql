create table if not exists signup_invites (
  token text primary key,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_by uuid references profiles(id),
  consumed_at timestamptz
);

alter table signup_invites enable row level security;

drop policy if exists "superadmin can manage signup invites" on signup_invites;
create policy "superadmin can manage signup invites"
on signup_invites for all
using (public.current_role() = 'superadmin')
with check (public.current_role() = 'superadmin');