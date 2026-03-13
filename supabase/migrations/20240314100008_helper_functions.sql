-- Authorization helper functions (used by RLS policies)
-- All live in authz schema for clear separation.

create or replace function authz.is_authenticated()
returns boolean
language sql
stable
security definer
set search_path = authz, public
as $$
  select auth.uid() is not null;
$$;

create or replace function authz.is_super_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = authz, public
as $$
begin
  return exists (
    select 1
    from authz.user_roles ur
    join authz.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'super_admin'
  );
end;
$$;

create or replace function authz.has_role(role_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = authz, public
as $$
begin
  return exists (
    select 1
    from authz.user_roles ur
    join authz.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = role_name
  );
end;
$$;

-- Check permission with wildcard: e.g. resource.update -> also allow resource.manage
create or replace function authz.has_permission(permission_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = authz, public
as $$
declare
  base_name text;
  manage_name text;
begin
  if permission_name is null or permission_name = '' then
    return false;
  end if;
  -- Exact match
  if exists (
    select 1
    from authz.user_roles ur
    join authz.role_permissions rp on rp.role_id = ur.role_id
    join authz.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid() and p.name = permission_name
  ) then
    return true;
  end if;
  -- Wildcard: resource.action -> resource.manage
  if position('.' in permission_name) > 0 then
    base_name := split_part(permission_name, '.', 1);
    manage_name := base_name || '.manage';
    return exists (
      select 1
      from authz.user_roles ur
      join authz.role_permissions rp on rp.role_id = ur.role_id
      join authz.permissions p on p.id = rp.permission_id
      where ur.user_id = auth.uid() and p.name = manage_name
    );
  end if;
  return false;
end;
$$;

create or replace function authz.is_org_member(org_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = authz, public
as $$
begin
  if org_id is null then
    return false;
  end if;
  return exists (
    select 1
    from authz.organization_members
    where user_id = auth.uid() and organization_id = org_id
  );
end;
$$;
