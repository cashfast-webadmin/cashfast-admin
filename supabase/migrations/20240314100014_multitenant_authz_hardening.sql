


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "authz";


ALTER SCHEMA "authz" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."lead_status" AS ENUM (
    'new',
    'contacted',
    'qualified',
    'proposal_sent',
    'negotiation',
    'won',
    'lost',
    'on_hold'
);


ALTER TYPE "public"."lead_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "authz"."current_org"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'authz', 'public'
    AS $$
  select (auth.jwt()->'app_metadata'->>'organization_id')::uuid
$$;


ALTER FUNCTION "authz"."current_org"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "authz"."has_permission"("permission_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'authz', 'public'
    AS $$
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


ALTER FUNCTION "authz"."has_permission"("permission_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "authz"."has_role"("role_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'authz', 'public'
    AS $$
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


ALTER FUNCTION "authz"."has_role"("role_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "authz"."is_authenticated"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'authz', 'public'
    AS $$
  select auth.uid() is not null;
$$;


ALTER FUNCTION "authz"."is_authenticated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "authz"."is_org_member"("org_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'authz', 'public'
    AS $$
begin
  if org_id is null then
    return false;
  end if;
  return authz.current_org() is not null and authz.current_org() = org_id;
end;
$$;


ALTER FUNCTION "authz"."is_org_member"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "authz"."is_super_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'authz', 'public'
    AS $$
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


ALTER FUNCTION "authz"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "authz"."jwt_organization_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'authz', 'public'
    AS $$
  select authz.current_org()
$$;


ALTER FUNCTION "authz"."jwt_organization_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "authz"."jwt_roles"() RETURNS "text"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'authz', 'public'
    AS $$
  select case
    when jsonb_typeof(auth.jwt()->'app_metadata'->'roles') = 'array' then
      array(select jsonb_array_elements_text(auth.jwt()->'app_metadata'->'roles'))
    else array[]::text[]
  end;
$$;


ALTER FUNCTION "authz"."jwt_roles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."custom_access_token_hook"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'authz'
    AS $$
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


ALTER FUNCTION "public"."custom_access_token_hook"("event" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leads_prevent_hard_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  raise exception 'Hard delete of leads is not allowed. Set deleted_at for soft delete.'
    using errcode = 'P0001';
  return null;
end;
$$;


ALTER FUNCTION "public"."leads_prevent_hard_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leads_set_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;


ALTER FUNCTION "public"."leads_set_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leads_status_history_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.status is distinct from new.status then
    insert into public.lead_status_history (lead_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."leads_status_history_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_lead"("payload" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'authz'
    AS $$
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


ALTER FUNCTION "public"."submit_lead"("payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."submit_lead"("payload" "jsonb") IS 'Submit a lead from website/app (anon/authenticated). Requires valid organization_slug or organization_id and applies anti-spam cooldown.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "authz"."organization_members" (
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "role" "text" NOT NULL
);


ALTER TABLE "authz"."organization_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "authz"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "slug" "text" NOT NULL,
    CONSTRAINT "organizations_slug_lowercase" CHECK (("slug" = "lower"("slug")))
);


ALTER TABLE "authz"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "authz"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "authz"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "authz"."role_permissions" (
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL
);


ALTER TABLE "authz"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "authz"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "authz"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "authz"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL
);


ALTER TABLE "authz"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "attempted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attempt_type" "text" NOT NULL,
    "outcome" "text",
    "notes" "text",
    "attempted_by" "uuid"
);


ALTER TABLE "public"."contact_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "comment" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "from_status" "public"."lead_status",
    "to_status" "public"."lead_status" NOT NULL,
    "change_reason" "text",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" DEFAULT "authz"."current_org"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "public"."citext",
    "phone" "text",
    "loan_amount" numeric(14,2),
    "loan_type" "text",
    "work_profile" "text" NOT NULL,
    "monthly_salary" numeric(14,2),
    "annual_sales" numeric(14,2),
    "source" "text" DEFAULT 'website'::"text" NOT NULL,
    "campaign" "text",
    "medium" "text",
    "referrer" "text",
    "lead_source_details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "public"."lead_status" DEFAULT 'new'::"public"."lead_status" NOT NULL,
    "customer_query" "text",
    "assigned_to" "uuid",
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "next_follow_up_at" timestamp with time zone,
    "last_contacted_at" timestamp with time zone,
    "updated_by" "uuid",
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "fingerprint" "text",
    CONSTRAINT "leads_contact_required" CHECK ((("email" IS NOT NULL) OR ("phone" IS NOT NULL))),
    CONSTRAINT "leads_non_negative_amounts" CHECK (((("loan_amount" IS NULL) OR ("loan_amount" >= (0)::numeric)) AND (("monthly_salary" IS NULL) OR ("monthly_salary" >= (0)::numeric)) AND (("annual_sales" IS NULL) OR ("annual_sales" >= (0)::numeric)))),
    CONSTRAINT "leads_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "leads_salary_sales_by_work_profile" CHECK (((("work_profile" = 'salaried'::"text") AND ("monthly_salary" IS NOT NULL) AND ("annual_sales" IS NULL)) OR (("work_profile" = 'self_employed'::"text") AND ("annual_sales" IS NOT NULL) AND ("monthly_salary" IS NULL)))),
    CONSTRAINT "leads_source_details_object" CHECK (("jsonb_typeof"("lead_source_details") = 'object'::"text")),
    CONSTRAINT "leads_work_profile_check" CHECK (("work_profile" = ANY (ARRAY['salaried'::"text", 'self_employed'::"text"])))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


COMMENT ON TABLE "public"."leads" IS 'Lead records; soft-delete only. Same email/phone may appear in multiple rows.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "created_by" "uuid",
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."resources" OWNER TO "postgres";


ALTER TABLE ONLY "authz"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("user_id", "organization_id");



ALTER TABLE ONLY "authz"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "authz"."permissions"
    ADD CONSTRAINT "permissions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "authz"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "authz"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");



ALTER TABLE ONLY "authz"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "authz"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "authz"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id");



ALTER TABLE ONLY "public"."contact_attempts"
    ADD CONSTRAINT "contact_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_comments"
    ADD CONSTRAINT "lead_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_status_history"
    ADD CONSTRAINT "lead_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_organization_members_org_id" ON "authz"."organization_members" USING "btree" ("organization_id");



CREATE INDEX "idx_organization_members_user_id" ON "authz"."organization_members" USING "btree" ("user_id");



CREATE INDEX "idx_organization_members_user_org" ON "authz"."organization_members" USING "btree" ("user_id", "organization_id");



CREATE UNIQUE INDEX "idx_organizations_slug_unique" ON "authz"."organizations" USING "btree" ("slug");



CREATE UNIQUE INDEX "idx_permissions_name" ON "authz"."permissions" USING "btree" ("name");



CREATE INDEX "idx_role_permissions_permission_id" ON "authz"."role_permissions" USING "btree" ("permission_id");



CREATE INDEX "idx_role_permissions_role_id" ON "authz"."role_permissions" USING "btree" ("role_id");



CREATE INDEX "idx_roles_name" ON "authz"."roles" USING "btree" ("name");



CREATE INDEX "idx_user_roles_role_id" ON "authz"."user_roles" USING "btree" ("role_id");



CREATE INDEX "idx_user_roles_user_id" ON "authz"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_contact_attempts_lead_id" ON "public"."contact_attempts" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_comments_lead_id" ON "public"."lead_comments" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_status_history_lead_id" ON "public"."lead_status_history" USING "btree" ("lead_id");



CREATE INDEX "idx_leads_open_follow_up" ON "public"."leads" USING "btree" ("organization_id", "next_follow_up_at") WHERE (("deleted_at" IS NULL) AND ("status" = ANY (ARRAY['new'::"public"."lead_status", 'contacted'::"public"."lead_status", 'qualified'::"public"."lead_status", 'proposal_sent'::"public"."lead_status", 'negotiation'::"public"."lead_status", 'on_hold'::"public"."lead_status"])));



CREATE INDEX "idx_leads_org_assigned_follow_up" ON "public"."leads" USING "btree" ("organization_id", "assigned_to", "next_follow_up_at");



CREATE INDEX "idx_leads_org_created_at" ON "public"."leads" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_leads_org_email" ON "public"."leads" USING "btree" ("organization_id", "email");



CREATE INDEX "idx_leads_org_email_created_at" ON "public"."leads" USING "btree" ("organization_id", "email", "created_at" DESC) WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_leads_org_fingerprint_created_at" ON "public"."leads" USING "btree" ("organization_id", "fingerprint", "created_at" DESC) WHERE ("fingerprint" IS NOT NULL);



CREATE INDEX "idx_leads_org_ip_created_at" ON "public"."leads" USING "btree" ("organization_id", "ip_address", "created_at" DESC) WHERE ("ip_address" IS NOT NULL);



CREATE INDEX "idx_leads_org_phone" ON "public"."leads" USING "btree" ("organization_id", "phone");



CREATE INDEX "idx_leads_org_phone_created_at" ON "public"."leads" USING "btree" ("organization_id", "phone", "created_at" DESC) WHERE ("phone" IS NOT NULL);



CREATE INDEX "idx_leads_org_status" ON "public"."leads" USING "btree" ("organization_id", "status");



CREATE INDEX "idx_leads_org_work_profile" ON "public"."leads" USING "btree" ("organization_id", "work_profile");



CREATE INDEX "idx_resources_organization_id" ON "public"."resources" USING "btree" ("organization_id");



CREATE OR REPLACE TRIGGER "leads_no_hard_delete" BEFORE DELETE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."leads_prevent_hard_delete"();



CREATE OR REPLACE TRIGGER "leads_status_history" AFTER UPDATE OF "status" ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."leads_status_history_insert"();



CREATE OR REPLACE TRIGGER "leads_updated" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."leads_set_updated"();



ALTER TABLE ONLY "authz"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "authz"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "authz"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "authz"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "authz"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "authz"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "authz"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "authz"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "authz"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "authz"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_attempts"
    ADD CONSTRAINT "contact_attempts_attempted_by_fkey" FOREIGN KEY ("attempted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contact_attempts"
    ADD CONSTRAINT "contact_attempts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_comments"
    ADD CONSTRAINT "lead_comments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_comments"
    ADD CONSTRAINT "lead_comments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_status_history"
    ADD CONSTRAINT "lead_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_status_history"
    ADD CONSTRAINT "lead_status_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "authz"."organizations"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "authz"."organizations"("id") ON DELETE CASCADE;



CREATE POLICY "Members can read membership of their orgs" ON "authz"."organization_members" FOR SELECT USING (("authz"."is_super_admin"() OR "authz"."is_org_member"("organization_id")));



CREATE POLICY "Members can read own organizations" ON "authz"."organizations" FOR SELECT USING (("authz"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "authz"."organization_members" "om"
  WHERE (("om"."organization_id" = "organizations"."id") AND ("om"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Org managers can delete organization_members in current org" ON "authz"."organization_members" FOR DELETE USING (((NOT "authz"."is_super_admin"()) AND ("authz"."current_org"() IS NOT NULL) AND ("organization_id" = "authz"."current_org"()) AND "authz"."has_permission"('user.manage'::"text")));



CREATE POLICY "Org managers can insert organization_members in current org" ON "authz"."organization_members" FOR INSERT WITH CHECK (((NOT "authz"."is_super_admin"()) AND ("authz"."current_org"() IS NOT NULL) AND ("organization_id" = "authz"."current_org"()) AND "authz"."has_permission"('user.manage'::"text")));



CREATE POLICY "Org managers can update organization_members in current org" ON "authz"."organization_members" FOR UPDATE USING (((NOT "authz"."is_super_admin"()) AND ("authz"."current_org"() IS NOT NULL) AND ("organization_id" = "authz"."current_org"()) AND "authz"."has_permission"('user.manage'::"text"))) WITH CHECK (((NOT "authz"."is_super_admin"()) AND ("authz"."current_org"() IS NOT NULL) AND ("organization_id" = "authz"."current_org"()) AND "authz"."has_permission"('user.manage'::"text")));



CREATE POLICY "Super admin can manage organization_members" ON "authz"."organization_members" USING ("authz"."is_super_admin"()) WITH CHECK ("authz"."is_super_admin"());



CREATE POLICY "Super admin can manage organizations" ON "authz"."organizations" USING ("authz"."is_super_admin"()) WITH CHECK ("authz"."is_super_admin"());



CREATE POLICY "Super admin can manage permissions" ON "authz"."permissions" USING ("authz"."is_super_admin"()) WITH CHECK ("authz"."is_super_admin"());



CREATE POLICY "Super admin can manage role_permissions" ON "authz"."role_permissions" USING ("authz"."is_super_admin"()) WITH CHECK ("authz"."is_super_admin"());



CREATE POLICY "Super admin can manage roles" ON "authz"."roles" USING ("authz"."is_super_admin"()) WITH CHECK ("authz"."is_super_admin"());



CREATE POLICY "Super admin can manage user_roles" ON "authz"."user_roles" USING ("authz"."is_super_admin"()) WITH CHECK ("authz"."is_super_admin"());



ALTER TABLE "authz"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "authz"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "authz"."permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "authz"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "authz"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "authz"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Org members can delete resources with resource.manage" ON "public"."resources" FOR DELETE USING (("authz"."is_org_member"("organization_id") AND "authz"."has_permission"('resource.manage'::"text")));



CREATE POLICY "Org members can insert contact_attempts with leads.manage" ON "public"."contact_attempts" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "contact_attempts"."lead_id") AND "authz"."is_org_member"("l"."organization_id") AND "authz"."has_permission"('leads.manage'::"text")))));



CREATE POLICY "Org members can insert lead_comments with leads.manage" ON "public"."lead_comments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "lead_comments"."lead_id") AND "authz"."is_org_member"("l"."organization_id") AND "authz"."has_permission"('leads.manage'::"text")))));



CREATE POLICY "Org members can insert leads with leads.manage" ON "public"."leads" FOR INSERT WITH CHECK (("authz"."is_org_member"("organization_id") AND "authz"."has_permission"('leads.manage'::"text")));



CREATE POLICY "Org members can insert resources with resource.manage" ON "public"."resources" FOR INSERT WITH CHECK (("authz"."is_org_member"("organization_id") AND "authz"."has_permission"('resource.manage'::"text")));



CREATE POLICY "Org members can read contact_attempts when can read lead" ON "public"."contact_attempts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "contact_attempts"."lead_id") AND "authz"."is_org_member"("l"."organization_id") AND ("authz"."has_permission"('leads.read'::"text") OR "authz"."has_permission"('leads.manage'::"text"))))));



CREATE POLICY "Org members can read lead_comments when can read lead" ON "public"."lead_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "lead_comments"."lead_id") AND "authz"."is_org_member"("l"."organization_id") AND ("authz"."has_permission"('leads.read'::"text") OR "authz"."has_permission"('leads.manage'::"text"))))));



CREATE POLICY "Org members can read lead_status_history when can read lead" ON "public"."lead_status_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "lead_status_history"."lead_id") AND "authz"."is_org_member"("l"."organization_id") AND ("authz"."has_permission"('leads.read'::"text") OR "authz"."has_permission"('leads.manage'::"text"))))));



CREATE POLICY "Org members can read leads with leads.read or leads.manage" ON "public"."leads" FOR SELECT USING (("authz"."is_org_member"("organization_id") AND ("authz"."has_permission"('leads.read'::"text") OR "authz"."has_permission"('leads.manage'::"text"))));



CREATE POLICY "Org members can read resources with resource.read" ON "public"."resources" FOR SELECT USING (("authz"."is_org_member"("organization_id") AND "authz"."has_permission"('resource.read'::"text")));



CREATE POLICY "Org members can update leads with leads.manage" ON "public"."leads" FOR UPDATE USING (("authz"."is_org_member"("organization_id") AND "authz"."has_permission"('leads.manage'::"text"))) WITH CHECK (("authz"."is_org_member"("organization_id") AND "authz"."has_permission"('leads.manage'::"text")));



CREATE POLICY "Org members can update resources with resource.manage" ON "public"."resources" FOR UPDATE USING (("authz"."is_org_member"("organization_id") AND "authz"."has_permission"('resource.manage'::"text"))) WITH CHECK (("authz"."is_org_member"("organization_id") AND "authz"."has_permission"('resource.manage'::"text")));



CREATE POLICY "Super admin full access to contact_attempts" ON "public"."contact_attempts" USING ("authz"."is_super_admin"()) WITH CHECK ("authz"."is_super_admin"());



CREATE POLICY "Super admin full access to lead_comments" ON "public"."lead_comments" USING ("authz"."is_super_admin"()) WITH CHECK ("authz"."is_super_admin"());



CREATE POLICY "Super admin full access to lead_status_history" ON "public"."lead_status_history" USING ("authz"."is_super_admin"()) WITH CHECK ("authz"."is_super_admin"());



CREATE POLICY "Super admin full access to leads" ON "public"."leads" USING ("authz"."is_super_admin"()) WITH CHECK ("authz"."is_super_admin"());



CREATE POLICY "Super admin full access to resources" ON "public"."resources" USING ("authz"."is_super_admin"()) WITH CHECK ("authz"."is_super_admin"());



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."contact_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resources" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "authz" TO "supabase_auth_admin";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."citextin"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."citextin"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."citextin"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citextin"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."citextout"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citextout"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citextout"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citextout"("public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citextrecv"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."citextrecv"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."citextrecv"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citextrecv"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."citextsend"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citextsend"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citextsend"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citextsend"("public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext"(boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."citext"(boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."citext"(boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext"(boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."citext"(character) TO "postgres";
GRANT ALL ON FUNCTION "public"."citext"(character) TO "anon";
GRANT ALL ON FUNCTION "public"."citext"(character) TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext"(character) TO "service_role";



GRANT ALL ON FUNCTION "public"."citext"("inet") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext"("inet") TO "anon";
GRANT ALL ON FUNCTION "public"."citext"("inet") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext"("inet") TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."citext_cmp"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_cmp"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_cmp"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_cmp"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_eq"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_eq"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_eq"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_eq"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_ge"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_ge"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_ge"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_ge"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_gt"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_gt"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_gt"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_gt"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_hash"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_hash"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_hash"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_hash"("public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_hash_extended"("public"."citext", bigint) TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_hash_extended"("public"."citext", bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."citext_hash_extended"("public"."citext", bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_hash_extended"("public"."citext", bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_larger"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_larger"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_larger"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_larger"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_le"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_le"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_le"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_le"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_lt"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_lt"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_lt"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_lt"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_ne"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_ne"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_ne"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_ne"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_cmp"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_cmp"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_cmp"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_cmp"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_ge"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_ge"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_ge"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_ge"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_gt"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_gt"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_gt"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_gt"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_le"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_le"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_le"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_le"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_lt"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_lt"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_lt"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_lt"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_smaller"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_smaller"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_smaller"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_smaller"("public"."citext", "public"."citext") TO "service_role";



REVOKE ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "supabase_auth_admin";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."leads_prevent_hard_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."leads_prevent_hard_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."leads_prevent_hard_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."leads_set_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."leads_set_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."leads_set_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."leads_status_history_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."leads_status_history_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."leads_status_history_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."replace"("public"."citext", "public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."replace"("public"."citext", "public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."replace"("public"."citext", "public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace"("public"."citext", "public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."split_part"("public"."citext", "public"."citext", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."split_part"("public"."citext", "public"."citext", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."split_part"("public"."citext", "public"."citext", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."split_part"("public"."citext", "public"."citext", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."strpos"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."strpos"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."strpos"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strpos"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_lead"("payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_lead"("payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_lead"("payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."translate"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."translate"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."translate"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."translate"("public"."citext", "public"."citext", "text") TO "service_role";












GRANT ALL ON FUNCTION "public"."max"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."max"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."max"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."max"("public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."min"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."min"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."min"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."min"("public"."citext") TO "service_role";



GRANT SELECT ON TABLE "authz"."organization_members" TO "supabase_auth_admin";



GRANT SELECT ON TABLE "authz"."permissions" TO "supabase_auth_admin";



GRANT SELECT ON TABLE "authz"."role_permissions" TO "supabase_auth_admin";



GRANT SELECT ON TABLE "authz"."roles" TO "supabase_auth_admin";



GRANT SELECT ON TABLE "authz"."user_roles" TO "supabase_auth_admin";









GRANT ALL ON TABLE "public"."contact_attempts" TO "anon";
GRANT ALL ON TABLE "public"."contact_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."lead_comments" TO "anon";
GRANT ALL ON TABLE "public"."lead_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_comments" TO "service_role";



GRANT ALL ON TABLE "public"."lead_status_history" TO "anon";
GRANT ALL ON TABLE "public"."lead_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."resources" TO "anon";
GRANT ALL ON TABLE "public"."resources" TO "authenticated";
GRANT ALL ON TABLE "public"."resources" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































--
-- Dumped schema changes for auth and storage
--

CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



