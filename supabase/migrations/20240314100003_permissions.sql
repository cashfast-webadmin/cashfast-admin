-- Permissions: resource.action format (e.g. resource.manage, resource.read)
create table authz.permissions (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

create unique index idx_permissions_name on authz.permissions(name);

alter table authz.permissions enable row level security;
