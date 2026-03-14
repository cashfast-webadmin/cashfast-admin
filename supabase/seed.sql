-- Seed data for cashfast-admin (idempotent)
-- Run after migrations via: supabase db reset

-- Roles
insert into authz.roles (name)
values
  ('super_admin'),
  ('admin'),
  ('member'),
  ('viewer')
on conflict (name) do nothing;

-- Permissions (resource.action format)
insert into authz.permissions (name)
values
  ('organization.manage'),
  ('organization.read'),
  ('user.manage'),
  ('user.read'),
  ('resource.manage'),
  ('resource.read'),
  ('leads.manage'),
  ('leads.read'),
  ('role.manage'),
  ('permission.manage')
on conflict (name) do nothing;

-- Role-permission mappings (idempotent: insert only if pair doesn't exist)
insert into authz.role_permissions (role_id, permission_id)
select r.id, p.id
from authz.roles r
cross join authz.permissions p
where r.name = 'super_admin'
on conflict (role_id, permission_id) do nothing;

insert into authz.role_permissions (role_id, permission_id)
select r.id, p.id
from authz.roles r
cross join authz.permissions p
where r.name = 'admin'
  and p.name in (
    'organization.manage', 'organization.read',
    'user.manage', 'user.read',
    'resource.manage', 'resource.read',
    'leads.manage', 'leads.read'
  )
on conflict (role_id, permission_id) do nothing;

insert into authz.role_permissions (role_id, permission_id)
select r.id, p.id
from authz.roles r
cross join authz.permissions p
where r.name = 'member'
  and p.name in (
    'organization.read', 'user.read',
    'resource.manage', 'resource.read',
    'leads.manage', 'leads.read'
  )
on conflict (role_id, permission_id) do nothing;

insert into authz.role_permissions (role_id, permission_id)
select r.id, p.id
from authz.roles r
cross join authz.permissions p
where r.name = 'viewer'
  and p.name in (
    'organization.read', 'user.read', 'resource.read',
    'leads.read'
  )
on conflict (role_id, permission_id) do nothing;

-- Default organization (idempotent)
insert into authz.organizations (name, slug)
values ('cashfast', 'cashfast')
on conflict (slug) do update set name = excluded.name;
