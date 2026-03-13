-- Example domain table and RLS policies for authz + public tables

-- Example application table (tenant-scoped)
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references authz.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text,
  created_at timestamptz default now()
);

create index idx_resources_organization_id on public.resources(organization_id);

alter table public.resources enable row level security;

-- Resources: super_admin override OR (org member + permission)
create policy "Super admin full access to resources"
  on public.resources for all
  using (authz.is_super_admin())
  with check (authz.is_super_admin());

create policy "Org members can read resources with resource.read"
  on public.resources for select
  using (
    authz.is_org_member(organization_id)
    and authz.has_permission('resource.read')
  );

create policy "Org members can insert resources with resource.manage"
  on public.resources for insert
  with check (
    authz.is_org_member(organization_id)
    and authz.has_permission('resource.manage')
  );

create policy "Org members can update resources with resource.manage"
  on public.resources for update
  using (
    authz.is_org_member(organization_id)
    and authz.has_permission('resource.manage')
  )
  with check (
    authz.is_org_member(organization_id)
    and authz.has_permission('resource.manage')
  );

create policy "Org members can delete resources with resource.manage"
  on public.resources for delete
  using (
    authz.is_org_member(organization_id)
    and authz.has_permission('resource.manage')
  );

-- Authz tables: only super_admin (or service role) can read/write
-- Deny by default; no public policies
create policy "Super admin can manage roles"
  on authz.roles for all
  using (authz.is_super_admin())
  with check (authz.is_super_admin());

create policy "Super admin can manage permissions"
  on authz.permissions for all
  using (authz.is_super_admin())
  with check (authz.is_super_admin());

create policy "Super admin can manage role_permissions"
  on authz.role_permissions for all
  using (authz.is_super_admin())
  with check (authz.is_super_admin());

create policy "Super admin can manage user_roles"
  on authz.user_roles for all
  using (authz.is_super_admin())
  with check (authz.is_super_admin());

-- Organizations: super_admin full access; members can read orgs they belong to
create policy "Super admin can manage organizations"
  on authz.organizations for all
  using (authz.is_super_admin())
  with check (authz.is_super_admin());

create policy "Members can read own organizations"
  on authz.organizations for select
  using (
    authz.is_super_admin()
    or exists (
      select 1 from authz.organization_members om
      where om.organization_id = organizations.id and om.user_id = auth.uid()
    )
  );

-- Organization members: super_admin full; users can read membership for orgs they belong to
create policy "Super admin can manage organization_members"
  on authz.organization_members for all
  using (authz.is_super_admin())
  with check (authz.is_super_admin());

create policy "Members can read membership of their orgs"
  on authz.organization_members for select
  using (
    authz.is_super_admin()
    or authz.is_org_member(organization_id)
  );
