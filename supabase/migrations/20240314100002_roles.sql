-- Global roles (RBAC)
create table authz.roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

create index idx_roles_name on authz.roles(name);

alter table authz.roles enable row level security;

-- Only super_admin / service role can manage roles (policies in 20240314100009)
