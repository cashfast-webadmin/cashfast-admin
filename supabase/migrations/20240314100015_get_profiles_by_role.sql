-- RPC: return profiles for users that have the given role (e.g. lead_executive).
-- Uses SECURITY DEFINER so it can read authz.roles and authz.user_roles without
-- granting SELECT on those tables to authenticated users.
create or replace function public.get_profiles_by_role(role_name text)
returns setof public.profiles
language sql
security definer
set search_path = public, authz
stable
as $$
  select p.*
  from public.profiles p
  join authz.user_roles ur on ur.user_id = p.id
  join authz.roles r on r.id = ur.role_id
  where r.name = role_name
  order by p.full_name;
$$;

comment on function public.get_profiles_by_role(text) is
  'Returns profiles for users that have the given role (e.g. lead_executive). Used for assignee lists.';

grant execute on function public.get_profiles_by_role(text) to authenticated;
grant execute on function public.get_profiles_by_role(text) to service_role;
