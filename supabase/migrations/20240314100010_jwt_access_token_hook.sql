-- Custom Access Token Hook: add roles and organization_id to JWT app_metadata
-- so RLS can use auth.jwt() for fewer DB lookups and simpler policies.

-- Hook runs at token issue/refresh; reads authz tables and sets app_metadata.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, authz
as $$
declare
  claims jsonb;
  app_meta jsonb;
  role_names jsonb;
  first_org_id uuid;
  uid uuid;
begin
  if event->'claims' is null then
    return event;
  end if;
  uid := (event->>'user_id')::uuid;
  claims := event->'claims';

  -- Preserve existing app_metadata, then add roles and organization_id
  app_meta := coalesce(claims->'app_metadata', '{}'::jsonb);
  if jsonb_typeof(app_meta) <> 'object' then
    app_meta := '{}'::jsonb;
  end if;

  -- Roles: array of role names from authz.user_roles + authz.roles
  select coalesce(jsonb_agg(r.name order by r.name), '[]'::jsonb)
  into role_names
  from authz.user_roles ur
  join authz.roles r on r.id = ur.role_id
  where ur.user_id = uid;

  app_meta := jsonb_set(coalesce(app_meta, '{}'), '{roles}', coalesce(role_names, '[]'::jsonb));

  -- First organization the user belongs to (for current-org context)
  select om.organization_id
  into first_org_id
  from authz.organization_members om
  where om.user_id = uid
  limit 1;

  if first_org_id is not null then
    app_meta := jsonb_set(app_meta, '{organization_id}', to_jsonb(first_org_id::text));
  end if;

  claims := jsonb_set(claims, '{app_metadata}', app_meta);
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Only Auth service can invoke the hook
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- Grant auth admin read access to authz tables used inside the hook
grant usage on schema authz to supabase_auth_admin;
grant select on authz.roles to supabase_auth_admin;
grant select on authz.user_roles to supabase_auth_admin;
grant select on authz.organization_members to supabase_auth_admin;

-- JWT-reading helpers: use claims when present for fewer DB lookups
create or replace function authz.jwt_roles()
returns text[]
language sql
stable
security definer
set search_path = authz, public
as $$
  select case
    when jsonb_typeof(auth.jwt()->'app_metadata'->'roles') = 'array' then
      array(select jsonb_array_elements_text(auth.jwt()->'app_metadata'->'roles'))
    else array[]::text[]
  end;
$$;

create or replace function authz.jwt_organization_id()
returns uuid
language sql
stable
security definer
set search_path = authz, public
as $$
  select (auth.jwt()->'app_metadata'->>'organization_id')::uuid;
$$;

-- Make helpers use JWT first, then fall back to DB
create or replace function authz.is_super_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = authz, public
as $$
begin
  if 'super_admin' = any(authz.jwt_roles()) then
    return true;
  end if;
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
  if role_name = any(authz.jwt_roles()) then
    return true;
  end if;
  return exists (
    select 1
    from authz.user_roles ur
    join authz.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = role_name
  );
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
  if authz.jwt_organization_id() = org_id then
    return true;
  end if;
  return exists (
    select 1
    from authz.organization_members
    where user_id = auth.uid() and organization_id = org_id
  );
end;
$$;
