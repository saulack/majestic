alter table profiles
  add column if not exists email text,
  add column if not exists role text not null default 'user'
    check (role in ('user', 'admin', 'superadmin'));

create unique index if not exists profiles_email_unique on profiles (lower(email));

alter table reservations
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  add column if not exists reviewed_by uuid references profiles(id),
  add column if not exists reviewed_at timestamptz;

create table if not exists admin_invites (
  token text primary key,
  email text not null,
  role text not null check (role = 'admin'),
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_by uuid references profiles(id),
  consumed_at timestamptz
);

create table if not exists role_grants (
  email text primary key,
  role text not null check (role in ('admin', 'superadmin')),
  created_at timestamptz not null default now()
);

alter table admin_invites enable row level security;

create or replace function public.profile_role(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = target_user_id;
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.profile_role(auth.uid());
$$;

drop policy if exists "users can update own reservations" on reservations;
drop policy if exists "users can delete own reservations" on reservations;

create policy "users can update own reservations"
on reservations for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can delete own reservations"
on reservations for delete
using (auth.uid() = user_id);

create policy "admins can moderate standard user reservations"
on reservations for update
using (
  public.current_role() = 'admin'
  and auth.uid() <> user_id
  and public.profile_role(user_id) = 'user'
)
with check (
  public.current_role() = 'admin'
  and auth.uid() <> user_id
  and public.profile_role(user_id) = 'user'
);

create policy "superadmin can moderate any reservation"
on reservations for update
using (public.current_role() = 'superadmin')
with check (public.current_role() = 'superadmin');

create policy "superadmin can manage admin invites"
on admin_invites for all
using (public.current_role() = 'superadmin')
with check (public.current_role() = 'superadmin');

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_role text;
  granted_role text;
  resolved_role text := 'user';
begin
  select role into granted_role
  from public.role_grants
  where lower(email) = lower(new.email)
  limit 1;

  if granted_role in ('admin', 'superadmin') then
    resolved_role := granted_role;
  end if;

  select role into invite_role
  from public.admin_invites
  where lower(email) = lower(new.email)
    and token = coalesce(new.raw_user_meta_data ->> 'invite_token', '')
    and consumed_at is null
    and expires_at > now()
  limit 1;

  if invite_role = 'admin' and resolved_role = 'user' then
    resolved_role := 'admin';

    update public.admin_invites
      set consumed_by = new.id,
          consumed_at = now()
    where lower(email) = lower(new.email)
      and token = coalesce(new.raw_user_meta_data ->> 'invite_token', '')
      and consumed_at is null;
  end if;

  if exists (
    select 1 from public.profiles p
    where lower(p.email) = lower(new.email)
      and p.id <> new.id
  ) then
    raise exception 'Duplicate email is not allowed.';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    resolved_role
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();
