-- Leads module: multi-tenant, soft-delete, enum status, citext email, comments, status history, contact attempts

create extension if not exists citext;

create type public.lead_status as enum (
  'new',
  'contacted',
  'qualified',
  'proposal_sent',
  'negotiation',
  'won',
  'lost',
  'on_hold'
);

-- Core leads table
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references authz.organizations(id),
  name text not null,
  email citext,
  phone text,
  loan_amount numeric(14,2),
  loan_type text,
  work_profile text not null check (work_profile in ('salaried', 'self_employed')),
  monthly_salary numeric(14,2),
  annual_sales numeric(14,2),
  source text not null default 'website',
  campaign text,
  medium text,
  referrer text,
  lead_source_details jsonb not null default '{}'::jsonb,
  status public.lead_status not null default 'new',
  customer_query text,
  assigned_to uuid references auth.users(id) on delete set null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_contact_required check (email is not null or phone is not null),
  constraint leads_non_negative_amounts check (
    (loan_amount is null or loan_amount >= 0) and
    (monthly_salary is null or monthly_salary >= 0) and
    (annual_sales is null or annual_sales >= 0)
  ),
  constraint leads_salary_sales_by_work_profile check (
    (work_profile = 'salaried' and monthly_salary is not null and annual_sales is null) or
    (work_profile = 'self_employed' and annual_sales is not null and monthly_salary is null)
  ),
  constraint leads_source_details_object check (jsonb_typeof(lead_source_details) = 'object')
);

-- Indexes for listing, filtering, and follow-up queue
create index idx_leads_org_created_at on public.leads(organization_id, created_at desc);
create index idx_leads_org_status on public.leads(organization_id, status);
create index idx_leads_org_work_profile on public.leads(organization_id, work_profile);
create index idx_leads_org_assigned_follow_up on public.leads(organization_id, assigned_to, next_follow_up_at);
create index idx_leads_org_email on public.leads(organization_id, email);
create index idx_leads_org_phone on public.leads(organization_id, phone);

-- Partial index: open leads with due follow-up (excludes deleted and terminal statuses)
create index idx_leads_open_follow_up on public.leads(organization_id, next_follow_up_at)
  where deleted_at is null
  and status in ('new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'on_hold');

-- Optional: email format when provided (basic pattern)
-- Skipping strict regex to avoid locale issues; app can validate.

comment on table public.leads is 'Lead records; soft-delete only. Same email/phone may appear in multiple rows.';

-- Lead comments (call notes, internal notes)
create table public.lead_comments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  comment text not null,
  created_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_lead_comments_lead_id on public.lead_comments(lead_id);

-- Status change history (audit trail)
create table public.lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_status public.lead_status,
  to_status public.lead_status not null,
  change_reason text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index idx_lead_status_history_lead_id on public.lead_status_history(lead_id);

-- Contact attempts (calls, whatsapp, email, sms)
create table public.contact_attempts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  attempt_type text not null,
  outcome text,
  notes text,
  attempted_by uuid references auth.users(id) on delete set null
);

create index idx_contact_attempts_lead_id on public.contact_attempts(lead_id);

-- Trigger: set updated_at and updated_by on leads
create or replace function public.leads_set_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger leads_updated
  before update on public.leads
  for each row execute function public.leads_set_updated();

-- Trigger: record status changes into lead_status_history
create or replace function public.leads_status_history_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.lead_status_history (lead_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger leads_status_history
  after update of status on public.leads
  for each row execute function public.leads_status_history_insert();

-- Trigger: prevent hard delete on leads (soft-delete only)
create or replace function public.leads_prevent_hard_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Hard delete of leads is not allowed. Set deleted_at for soft delete.'
    using errcode = 'P0001';
  return null;
end;
$$;

create trigger leads_no_hard_delete
  before delete on public.leads
  for each row execute function public.leads_prevent_hard_delete();

-- RLS: leads
alter table public.leads enable row level security;

create policy "Super admin full access to leads"
  on public.leads for all
  using (authz.is_super_admin())
  with check (authz.is_super_admin());

create policy "Org members can read leads with leads.read or leads.manage"
  on public.leads for select
  using (
    authz.is_org_member(organization_id)
    and (authz.has_permission('leads.read') or authz.has_permission('leads.manage'))
  );

create policy "Org members can insert leads with leads.manage"
  on public.leads for insert
  with check (
    authz.is_org_member(organization_id)
    and authz.has_permission('leads.manage')
  );

create policy "Org members can update leads with leads.manage"
  on public.leads for update
  using (
    authz.is_org_member(organization_id)
    and authz.has_permission('leads.manage')
  )
  with check (
    authz.is_org_member(organization_id)
    and authz.has_permission('leads.manage')
  );

-- No delete policy for org members: only soft delete via updated_at/deleted_at.

-- RLS: lead_comments (read/write scoped by lead's organization)
alter table public.lead_comments enable row level security;

create policy "Super admin full access to lead_comments"
  on public.lead_comments for all
  using (authz.is_super_admin())
  with check (authz.is_super_admin());

create policy "Org members can read lead_comments when can read lead"
  on public.lead_comments for select
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_comments.lead_id
        and authz.is_org_member(l.organization_id)
        and (authz.has_permission('leads.read') or authz.has_permission('leads.manage'))
    )
  );

create policy "Org members can insert lead_comments with leads.manage"
  on public.lead_comments for insert
  with check (
    exists (
      select 1 from public.leads l
      where l.id = lead_comments.lead_id
        and authz.is_org_member(l.organization_id)
        and authz.has_permission('leads.manage')
    )
  );

-- RLS: lead_status_history
alter table public.lead_status_history enable row level security;

create policy "Super admin full access to lead_status_history"
  on public.lead_status_history for all
  using (authz.is_super_admin())
  with check (authz.is_super_admin());

create policy "Org members can read lead_status_history when can read lead"
  on public.lead_status_history for select
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_status_history.lead_id
        and authz.is_org_member(l.organization_id)
        and (authz.has_permission('leads.read') or authz.has_permission('leads.manage'))
    )
  );

-- RLS: contact_attempts
alter table public.contact_attempts enable row level security;

create policy "Super admin full access to contact_attempts"
  on public.contact_attempts for all
  using (authz.is_super_admin())
  with check (authz.is_super_admin());

create policy "Org members can read contact_attempts when can read lead"
  on public.contact_attempts for select
  using (
    exists (
      select 1 from public.leads l
      where l.id = contact_attempts.lead_id
        and authz.is_org_member(l.organization_id)
        and (authz.has_permission('leads.read') or authz.has_permission('leads.manage'))
    )
  );

create policy "Org members can insert contact_attempts with leads.manage"
  on public.contact_attempts for insert
  with check (
    exists (
      select 1 from public.leads l
      where l.id = contact_attempts.lead_id
        and authz.is_org_member(l.organization_id)
        and authz.has_permission('leads.manage')
    )
  );
