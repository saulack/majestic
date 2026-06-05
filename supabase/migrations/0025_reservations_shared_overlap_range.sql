alter table reservations
  add column if not exists shared_range_start_date date,
  add column if not exists shared_range_end_date date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservations_shared_range_pair_chk'
  ) then
    alter table reservations
      add constraint reservations_shared_range_pair_chk
      check (
        (shared_range_start_date is null and shared_range_end_date is null)
        or
        (shared_range_start_date is not null and shared_range_end_date is not null)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservations_shared_range_order_chk'
  ) then
    alter table reservations
      add constraint reservations_shared_range_order_chk
      check (
        shared_range_start_date is null
        or shared_range_end_date is null
        or shared_range_start_date <= shared_range_end_date
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservations_shared_range_within_booking_chk'
  ) then
    alter table reservations
      add constraint reservations_shared_range_within_booking_chk
      check (
        shared_range_start_date is null
        or shared_range_end_date is null
        or (
          shared_range_start_date >= start_date
          and shared_range_end_date <= end_date
        )
      );
  end if;
end $$;
