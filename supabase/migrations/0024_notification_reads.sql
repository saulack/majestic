create table if not exists notification_reads (
  user_id uuid not null references profiles(id) on delete cascade,
  notification_id text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

create index if not exists notification_reads_user_idx
  on notification_reads (user_id, read_at desc);

alter table notification_reads enable row level security;

create policy "users can read own notification read state"
on notification_reads for select
using (auth.role() = 'authenticated' and auth.uid() = user_id);

create policy "users can insert own notification read state"
on notification_reads for insert
with check (auth.role() = 'authenticated' and auth.uid() = user_id);

create policy "users can update own notification read state"
on notification_reads for update
using (auth.role() = 'authenticated' and auth.uid() = user_id)
with check (auth.role() = 'authenticated' and auth.uid() = user_id);

grant select, insert, update on table notification_reads to authenticated;
