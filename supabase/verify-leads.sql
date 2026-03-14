-- Verification script for leads module (run after supabase db reset).
-- Execute as postgres or service role so RLS does not block.
-- Usage: psql $DATABASE_URL -f supabase/verify-leads.sql
-- Or run snippets in Supabase SQL Editor (Dashboard) with service role.

-- 1) Insert salaried lead (should succeed)
insert into public.leads (
  organization_id,
  name,
  email,
  phone,
  work_profile,
  monthly_salary,
  source
) values (
  (select id from authz.organizations limit 1),
  'Test Salaried',
  'salaried@example.com',
  '9876543210',
  'salaried',
  50000,
  'website'
);

-- 2) Insert self-employed lead (should succeed)
insert into public.leads (
  organization_id,
  name,
  phone,
  work_profile,
  annual_sales,
  source
) values (
  (select id from authz.organizations limit 1),
  'Test Self-Employed',
  '9876543211',
  'self_employed',
  1500000,
  'website'
);

-- 3) Update status and check lead_status_history (trigger)
update public.leads
set status = 'contacted'
where email = 'salaried@example.com';

select count(*) as status_history_count
from public.lead_status_history lsh
join public.leads l on l.id = lsh.lead_id
where l.email = 'salaried@example.com';
-- Expect 1 row (new -> contacted).

-- 4) Hard delete should be blocked (run separately; expect error)
-- delete from public.leads where email = 'salaried@example.com';

-- 5) Soft delete (should succeed)
update public.leads
set deleted_at = now()
where email = 'salaried@example.com';

-- 6) Cleanup test rows (soft-deleted and self-employed)
update public.leads
set deleted_at = now()
where phone = '9876543211';
