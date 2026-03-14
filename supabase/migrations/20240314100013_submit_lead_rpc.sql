-- Public RPC for website/anonymous lead submission. Uses default org; no auth required.

create or replace function public.submit_lead(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, authz
as $$
declare
  org_id uuid;
  lead_id uuid;
  v_name text;
  v_email text;
  v_phone text;
  v_work_profile text;
  v_monthly_salary numeric(14,2);
  v_annual_sales numeric(14,2);
begin
  v_email := nullif(trim(payload->>'email'), '');
  v_phone := nullif(trim(payload->>'phone'), '');
  if v_email is null and v_phone is null then
    raise exception 'At least one of email or phone is required' using errcode = 'P0001';
  end if;

  select id into org_id from authz.organizations limit 1;
  if org_id is null then
    raise exception 'No organization configured' using errcode = 'P0001';
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
    customer_query
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
    nullif(trim(payload->>'customer_query'), '')
  )
  returning id into lead_id;
  return lead_id;
end;
$$;

comment on function public.submit_lead(jsonb) is 'Submit a lead from the website (anon). Uses default organization.';

grant execute on function public.submit_lead(jsonb) to anon;
grant execute on function public.submit_lead(jsonb) to authenticated;
