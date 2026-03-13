-- Multi-tenant organizations
create table authz.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

alter table authz.organizations enable row level security;
