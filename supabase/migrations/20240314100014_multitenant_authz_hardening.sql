-- Multi-tenant authz hardening:
-- - deterministic organization slug + bootstrap
-- - system-role model with org-scoped RLS (super_admin bypass remains role-based)
-- - strict current_org() from JWT claims
-- - hardened submit_lead RPC with org validation + anti-spam

-- ---------------------------------------------------------------------------
-- Organizations: add slug and enforce deterministic lookup
-- ---------------------------------------------------------------------------

alter table authz.organizations
  add column if not exists slug text;

-- Normalize existing slugs from slug/name.
with normalized as (
  select
    o.id,
    lower(
      trim(
        both '-'
        from regexp_replace(
          coalesce(nullif(trim(o.slug), ''), nullif(trim(o.name), ''), 'org'),
          '[^a-zA-Z0-9]+',
          '-',
          'g'
        )
      )
    ) as base_slug
  from authz.organizations o
),
ranked as (
  select
    n.id,
    n.base_slug,
    row_number() over (partition by n.base_slug order by n.id) as rn
  from normalized n
)
update authz.organizations o
set slug = case
  when r.rn = 1 then r.base_slug
  else r.base_slug || '-' || substr(o.id::text, 1, 8)
end
from ranked r
where o.id = r.id;

-- Ensure deterministic default org exists.
insert into authz.organizations (name, slug)
values ('cashfast', 'cashfast')
on conflict do nothing;

-- Enforce slug constraints.
alter table authz.organizations
  alter column slug set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_slug_lowercase'
  ) then
    alter table authz.organizations
      add constraint organizations_slug_lowercase
      check (slug = lower(slug));
  end if;
end $$;

create unique index if not exists idx_organizations_slug_unique
  on authz.organizations(slug);

-- ---------------------------------------------------------------------------
-- Helper functions: strict org derivation from JWT
-- ---------------------------------------------------------------------------

create or replace function authz.current_org()
returns uuid
language sql
stable
security definer
set search_path = authz, public
as $$
  select (auth.jwt()->'app_metadata'->>'organization_id')::uuid
$$;

create or replace function authz.jwt_organization_id()
returns uuid
language sql
stable
security definer
set search_path = authz, public
as $$
  select authz.current_org()
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
  return authz.current_org() is not null and authz.current_org() = org_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- JWT hook alignment (roles, permissions, deterministic organization)
-- ---------------------------------------------------------------------------

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

  select coalesce(jsonb_agg(r.name order by r.name), '[]'::jsonb)
  into role_names
  from authz.user_roles ur
  join authz.roles r on r.id = ur.role_id
  where ur.user_id = uid;

  app_meta := jsonb_set(app_meta, '{roles}', coalesce(role_names, '[]'::jsonb));

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

  -- Deterministic org selection: lexical smallest org id.
  select om.organization_id
  into first_org_id
  from authz.organization_members om
  where om.user_id = uid
  order by om.organization_id
  limit 1;

  if first_org_id is not null then
    app_meta := jsonb_set(app_meta, '{organization_id}', to_jsonb(first_org_id::text));
  else
    app_meta := app_meta - 'organization_id';
  end if;

  claims := jsonb_set(claims, '{app_metadata}', app_meta);
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant usage on schema authz to supabase_auth_admin;
grant select on authz.roles to supabase_auth_admin;
grant select on authz.user_roles to supabase_auth_admin;
grant select on authz.permissions to supabase_auth_admin;
grant select on authz.role_permissions to supabase_auth_admin;
grant select on authz.organization_members to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- RLS: organization_members write scope (non-super-admin => own org only)
-- ---------------------------------------------------------------------------

create policy "Org managers can insert organization_members in current org"
  on authz.organization_members for insert
  with check (
    not authz.is_super_admin()
    and authz.current_org() is not null
    and organization_id = authz.current_org()
    and authz.has_permission('user.manage')
  );

create policy "Org managers can update organization_members in current org"
  on authz.organization_members for update
  using (
    not authz.is_super_admin()
    and authz.current_org() is not null
    and organization_id = authz.current_org()
    and authz.has_permission('user.manage')
  )
  with check (
    not authz.is_super_admin()
    and authz.current_org() is not null
    and organization_id = authz.current_org()
    and authz.has_permission('user.manage')
  );

create policy "Org managers can delete organization_members in current org"
  on authz.organization_members for delete
  using (
    not authz.is_super_admin()
    and authz.current_org() is not null
    and organization_id = authz.current_org()
    and authz.has_permission('user.manage')
  );

-- ---------------------------------------------------------------------------
-- Leads table hardening for anti-spam metadata + default org
-- ---------------------------------------------------------------------------

alter table public.leads
  add column if not exists ip_address inet,
  add column if not exists user_agent text,
  add column if not exists fingerprint text;

alter table public.leads
  alter column organization_id set default authz.current_org();

create index if not exists idx_leads_org_phone_created_at
  on public.leads(organization_id, phone, created_at desc)
  where phone is not null;

create index if not exists idx_leads_org_email_created_at
  on public.leads(organization_id, email, created_at desc)
  where email is not null;

create index if not exists idx_leads_org_fingerprint_created_at
  on public.leads(organization_id, fingerprint, created_at desc)
  where fingerprint is not null;

create index if not exists idx_leads_org_ip_created_at
  on public.leads(organization_id, ip_address, created_at desc)
  where ip_address is not null;

-- ---------------------------------------------------------------------------
-- Public submit RPC: explicit org resolution + anti-spam
-- ---------------------------------------------------------------------------

create or replace function public.submit_lead(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, authz
as $$
declare
  org_id uuid;
  org_slug text;
  org_id_text text;
  requested_org_id uuid;
  lead_id uuid;
  v_name text;
  v_email text;
  v_phone text;
  v_work_profile text;
  v_monthly_salary numeric(14,2);
  v_annual_sales numeric(14,2);
  v_user_agent text;
  v_fingerprint text;
  v_ip_text text;
  v_ip_address inet;
  cooldown interval := interval '60 seconds';
begin
  if auth.role() not in ('anon', 'authenticated') then
    raise exception 'submit_lead is not allowed for role: %', coalesce(auth.role(), 'null')
      using errcode = '42501';
  end if;

  v_email := nullif(trim(payload->>'email'), '');
  v_phone := nullif(trim(payload->>'phone'), '');
  if v_email is null and v_phone is null then
    raise exception 'At least one of email or phone is required' using errcode = '22023';
  end if;

  org_slug := nullif(lower(trim(payload->>'organization_slug')), '');
  org_id_text := nullif(trim(payload->>'organization_id'), '');

  if org_slug is null and org_id_text is null then
    raise exception 'organization_slug or organization_id is required' using errcode = '22023';
  end if;

  if org_id_text is not null then
    begin
      requested_org_id := org_id_text::uuid;
    exception when invalid_text_representation then
      raise exception 'organization_id must be a valid uuid' using errcode = '22023';
    end;
  end if;

  if requested_org_id is not null and org_slug is not null then
    select id
    into org_id
    from authz.organizations
    where id = requested_org_id and slug = org_slug;
  elsif requested_org_id is not null then
    select id
    into org_id
    from authz.organizations
    where id = requested_org_id;
  else
    select id
    into org_id
    from authz.organizations
    where slug = org_slug;
  end if;

  if org_id is null then
    raise exception 'Invalid organization reference' using errcode = '22023';
  end if;

  v_name := coalesce(trim(payload->>'name'), '');
  v_work_profile := lower(coalesce(nullif(trim(payload->>'work_profile'), ''), 'salaried'));
  v_work_profile := case
    when v_work_profile in ('self-employed', 'self_employed') then 'self_employed'
    else 'salaried'
  end;

  if v_work_profile = 'salaried' then
    v_monthly_salary := (payload->>'monthly_salary')::numeric;
    if v_monthly_salary is null then
      v_monthly_salary := 0;
    end if;
    v_annual_sales := null;
  else
    v_annual_sales := (payload->>'annual_sales')::numeric;
    if v_annual_sales is null then
      v_annual_sales := 0;
    end if;
    v_monthly_salary := null;
  end if;

  v_user_agent := nullif(trim(payload->>'user_agent'), '');
  v_fingerprint := nullif(trim(payload->>'fingerprint'), '');
  v_ip_text := nullif(trim(payload->>'ip_address'), '');

  if v_ip_text is not null then
    begin
      v_ip_address := v_ip_text::inet;
    exception when invalid_text_representation then
      raise exception 'ip_address must be a valid IP value' using errcode = '22023';
    end;
  end if;

  if exists (
    select 1
    from public.leads l
    where l.organization_id = org_id
      and l.deleted_at is null
      and l.created_at >= now() - cooldown
      and (
        (v_phone is not null and l.phone = v_phone)
        or (v_email is not null and l.email = v_email)
        or (v_fingerprint is not null and l.fingerprint = v_fingerprint)
        or (v_ip_address is not null and l.ip_address = v_ip_address)
      )
  ) then
    raise exception 'Please wait before submitting again' using errcode = 'P0001';
  end if;

  insert into public.leads (
    organization_id,
    name,
    email,
    phone,
    loan_amount,
    loan_type,
    work_profile,
    monthly_salary,
    annual_sales,
    source,
    campaign,
    medium,
    referrer,
    lead_source_details,
    customer_query,
    ip_address,
    user_agent,
    fingerprint
  ) values (
    org_id,
    v_name,
    v_email,
    v_phone,
    (payload->>'loan_amount')::numeric,
    nullif(trim(payload->>'loan_type'), ''),
    v_work_profile,
    v_monthly_salary,
    v_annual_sales,
    coalesce(nullif(trim(payload->>'source'), ''), 'website'),
    nullif(trim(payload->>'campaign'), ''),
    nullif(trim(payload->>'medium'), ''),
    nullif(trim(payload->>'referrer'), ''),
    coalesce(payload->'lead_source_details', '{}'::jsonb),
    nullif(trim(payload->>'customer_query'), ''),
    v_ip_address,
    v_user_agent,
    v_fingerprint
  )
  returning id into lead_id;

  return lead_id;
end;
$$;

comment on function public.submit_lead(jsonb) is
  'Submit a lead from website/app (anon/authenticated). Requires valid organization_slug or organization_id and applies anti-spam cooldown.';

