-- Organization membership (tenant-scoped roles: owner, admin, member, viewer)
create table authz.organization_members (
  user_id uuid references auth.users(id) on delete cascade,
  organization_id uuid references authz.organizations(id) on delete cascade,
  role text not null,
  primary key (user_id, organization_id)
);

create index idx_organization_members_user_id on authz.organization_members(user_id);
create index idx_organization_members_org_id on authz.organization_members(organization_id);
create index idx_organization_members_user_org on authz.organization_members(user_id, organization_id);

alter table authz.organization_members enable row level security;
