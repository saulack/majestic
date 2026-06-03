-- Add decline_reason column to reservations
alter table reservations
  add column if not exists decline_reason text;

-- Expand admin moderation to cover any reservation they don't own
-- (previously admins could only moderate 'user'-role reservation owners)
drop policy if exists "admins can moderate standard user reservations" on reservations;

create policy "admins can moderate any reservation"
on reservations for update
using (
  public.current_role() in ('admin', 'superadmin')
  and auth.uid() <> user_id
)
with check (
  public.current_role() in ('admin', 'superadmin')
  and auth.uid() <> user_id
);
