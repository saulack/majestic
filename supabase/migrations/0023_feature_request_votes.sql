create table if not exists feature_request_votes (
  id uuid primary key default gen_random_uuid(),
  feature_request_id uuid not null references feature_requests(id) on delete cascade,
  voted_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (feature_request_id, voted_by)
);

create index if not exists feature_request_votes_request_idx
  on feature_request_votes (feature_request_id, created_at desc);

create index if not exists feature_request_votes_voted_by_idx
  on feature_request_votes (voted_by, created_at desc);

alter table feature_request_votes enable row level security;

create policy "feature request votes readable by authenticated users"
on feature_request_votes for select
using (auth.role() = 'authenticated');

create policy "authenticated users can create own feature request votes"
on feature_request_votes for insert
with check (auth.role() = 'authenticated' and auth.uid() = voted_by);

create policy "users can delete own feature request votes"
on feature_request_votes for delete
using (auth.role() = 'authenticated' and auth.uid() = voted_by);

grant select, insert, delete on table feature_request_votes to authenticated;