-- Add permissions array to JWT app_metadata (user's permission names from role_permissions).
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
  permission_names jsonb;
  first_org_id uuid;
  uid uuid;
begin
  if event->'claims' is null then
    return event;
  end if;
  uid := (event->>'user_id')::uuid;
  claims := event->'claims';

  app_meta := coalesce(claims->'app_metadata', '{}'::jsonb);
  if jsonb_typeof(app_meta) <> 'object' then
    app_meta := '{}'::jsonb;
  end if;

  -- Roles: array of role names
  select coalesce(jsonb_agg(r.name order by r.name), '[]'::jsonb)
  into role_names
  from authz.user_roles ur
  join authz.roles r on r.id = ur.role_id
  where ur.user_id = uid;
  app_meta := jsonb_set(coalesce(app_meta, '{}'), '{roles}', coalesce(role_names, '[]'::jsonb));

  -- Permissions: distinct permission names from user's roles
  select coalesce(jsonb_agg(perm order by perm), '[]'::jsonb)
  into permission_names
  from (
    select distinct p.name as perm
    from authz.user_roles ur
    join authz.role_permissions rp on rp.role_id = ur.role_id
    join authz.permissions p on p.id = rp.permission_id
    where ur.user_id = uid
  ) t;
  app_meta := jsonb_set(app_meta, '{permissions}', coalesce(permission_names, '[]'::jsonb));

  -- First organization
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

grant select on authz.permissions to supabase_auth_admin;
grant select on authz.role_permissions to supabase_auth_admin;
