-- Role-to-permission mapping
create table authz.role_permissions (
  role_id uuid references authz.roles(id) on delete cascade,
  permission_id uuid references authz.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create index idx_role_permissions_role_id on authz.role_permissions(role_id);
create index idx_role_permissions_permission_id on authz.role_permissions(permission_id);

alter table authz.role_permissions enable row level security;
