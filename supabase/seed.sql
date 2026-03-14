-- Seed data for cashfast-admin (idempotent)
-- Run after migrations via: supabase db reset

-- Roles
insert into authz.roles (name)
values
  ('super_admin'),
  ('admin'),
  ('member'),
  ('viewer'),
  ('lead_executive')
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
  ('faqs.manage'),
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
    'leads.manage', 'leads.read',
    'faqs.manage'
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
    'leads.manage', 'leads.read',
    'faqs.manage'
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

insert into authz.role_permissions (role_id, permission_id)
select r.id, p.id
from authz.roles r
cross join authz.permissions p
where r.name = 'lead_executive'
  and p.name in (
    'organization.read', 'user.read',
    'leads.manage', 'leads.read'
  )
on conflict (role_id, permission_id) do nothing;

-- Default organization (idempotent)
insert into authz.organizations (name, slug)
values ('cashfast', 'cashfast')
on conflict (slug) do update set name = excluded.name;

-- Optional: assign admin@cashfast.com as super_admin
insert into authz.user_roles (user_id, role_id)
select u.id, r.id
from auth.users u
join authz.roles r on r.name = 'super_admin'
where u.email = 'admin@cashfast.com'
on conflict (user_id, role_id) do nothing;

-- Optional: attach admin@cashfast.com to cashfast organization
insert into authz.organization_members (user_id, organization_id, role)
select u.id, o.id, 'owner'
from auth.users u
join authz.organizations o on o.slug = 'cashfast'
where u.email = 'admin@cashfast.com'
on conflict (user_id, organization_id) do nothing;

-- Optional: assign lead@cashfast.com as lead_executive
insert into authz.user_roles (user_id, role_id)
select u.id, r.id
from auth.users u
join authz.roles r on r.name = 'lead_executive'
where u.email = 'lead@cashfast.com'
on conflict (user_id, role_id) do nothing;

-- Optional: attach lead@cashfast.com to cashfast organization
insert into authz.organization_members (user_id, organization_id, role)
select u.id, o.id, 'member'
from auth.users u
join authz.organizations o on o.slug = 'cashfast'
where u.email = 'lead@cashfast.com'
on conflict (user_id, organization_id) do nothing;
