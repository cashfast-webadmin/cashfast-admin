-- User-to-role assignment (global RBAC)
create table authz.user_roles (
  user_id uuid references auth.users(id) on delete cascade,
  role_id uuid references authz.roles(id) on delete cascade,
  primary key (user_id, role_id)
);

create index idx_user_roles_user_id on authz.user_roles(user_id);
create index idx_user_roles_role_id on authz.user_roles(role_id);

alter table authz.user_roles enable row level security;
