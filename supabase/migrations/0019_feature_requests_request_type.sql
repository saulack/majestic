alter table feature_requests
  add column if not exists request_type text;

update feature_requests
set request_type = 'feature'
where request_type is null;

alter table feature_requests
  alter column request_type set default 'feature';

alter table feature_requests
  alter column request_type set not null;

alter table feature_requests
  drop constraint if exists feature_requests_request_type_check;

alter table feature_requests
  add constraint feature_requests_request_type_check
  check (request_type in ('feature', 'bug'));

create index if not exists feature_requests_type_status_idx
  on feature_requests (request_type, status, updated_at desc);
