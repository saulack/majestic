alter table info_contacts
  add column if not exists is_maintenance boolean not null default false,
  add column if not exists maintenance_category text;

create index if not exists info_contacts_maintenance_category_idx
  on info_contacts (lower(maintenance_category));

-- Keep new maintenance contacts easy to model by inheriting the contact function when category is missing.
update info_contacts
set maintenance_category = role_function
where is_maintenance = true
  and coalesce(trim(maintenance_category), '') = '';
