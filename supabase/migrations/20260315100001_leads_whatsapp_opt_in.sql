-- WhatsApp opt-in: column on leads, submit_lead accepts it, trigger gates WhatsApp by it.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.leads.whatsapp_opt_in IS 'Whether to send WhatsApp acknowledgement; from form preference.';

-- Recreate submit_lead to accept and persist whatsapp_opt_in.
CREATE OR REPLACE FUNCTION public.submit_lead(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, authz
AS $$
DECLARE
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
  v_whatsapp_opt_in boolean;
  cooldown interval := interval '60 seconds';
BEGIN
  IF auth.role() NOT IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'submit_lead is not allowed for role: %', COALESCE(auth.role(), 'null')
      USING errcode = '42501';
  END IF;

  v_email := nullif(trim(payload->>'email'), '');
  v_phone := nullif(trim(payload->>'phone'), '');
  IF v_email IS NULL AND v_phone IS NULL THEN
    RAISE EXCEPTION 'At least one of email or phone is required' USING errcode = '22023';
  END IF;

  org_slug := nullif(lower(trim(payload->>'organization_slug')), '');
  org_id_text := nullif(trim(payload->>'organization_id'), '');

  IF org_slug IS NULL AND org_id_text IS NULL THEN
    RAISE EXCEPTION 'organization_slug or organization_id is required' USING errcode = '22023';
  END IF;

  IF org_id_text IS NOT NULL THEN
    BEGIN
      requested_org_id := org_id_text::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'organization_id must be a valid uuid' USING errcode = '22023';
    END;
  END IF;

  IF requested_org_id IS NOT NULL AND org_slug IS NOT NULL THEN
    SELECT id INTO org_id FROM authz.organizations WHERE id = requested_org_id AND slug = org_slug;
  ELSIF requested_org_id IS NOT NULL THEN
    SELECT id INTO org_id FROM authz.organizations WHERE id = requested_org_id;
  ELSE
    SELECT id INTO org_id FROM authz.organizations WHERE slug = org_slug;
  END IF;

  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Invalid organization reference' USING errcode = '22023';
  END IF;

  v_name := coalesce(trim(payload->>'name'), '');
  v_work_profile := lower(coalesce(nullif(trim(payload->>'work_profile'), ''), 'salaried'));
  v_work_profile := CASE
    WHEN v_work_profile IN ('self-employed', 'self_employed') THEN 'self_employed'
    ELSE 'salaried'
  END;

  IF v_work_profile = 'salaried' THEN
    v_monthly_salary := (payload->>'monthly_salary')::numeric;
    IF v_monthly_salary IS NULL THEN v_monthly_salary := 0; END IF;
    v_annual_sales := NULL;
  ELSE
    v_annual_sales := (payload->>'annual_sales')::numeric;
    IF v_annual_sales IS NULL THEN v_annual_sales := 0; END IF;
    v_monthly_salary := NULL;
  END IF;

  v_user_agent := nullif(trim(payload->>'user_agent'), '');
  v_fingerprint := nullif(trim(payload->>'fingerprint'), '');
  v_ip_text := nullif(trim(payload->>'ip_address'), '');
  v_whatsapp_opt_in := coalesce((payload->>'whatsapp_opt_in')::boolean, true);

  IF v_ip_text IS NOT NULL THEN
    BEGIN
      v_ip_address := v_ip_text::inet;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'ip_address must be a valid IP value' USING errcode = '22023';
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.organization_id = org_id
      AND l.deleted_at IS NULL
      AND l.created_at >= now() - cooldown
      AND (
        (v_phone IS NOT NULL AND l.phone = v_phone)
        OR (v_email IS NOT NULL AND l.email = v_email)
        OR (v_fingerprint IS NOT NULL AND l.fingerprint = v_fingerprint)
        OR (v_ip_address IS NOT NULL AND l.ip_address = v_ip_address)
      )
  ) THEN
    RAISE EXCEPTION 'Please wait before submitting again' USING errcode = 'P0001';
  END IF;

  INSERT INTO public.leads (
    organization_id, name, email, phone,
    loan_amount, loan_type, work_profile, monthly_salary, annual_sales,
    source, campaign, medium, referrer, lead_source_details, customer_query,
    ip_address, user_agent, fingerprint, whatsapp_opt_in
  ) VALUES (
    org_id, v_name, v_email, v_phone,
    (payload->>'loan_amount')::numeric, nullif(trim(payload->>'loan_type'), ''),
    v_work_profile, v_monthly_salary, v_annual_sales,
    coalesce(nullif(trim(payload->>'source'), ''), 'website'),
    nullif(trim(payload->>'campaign'), ''),
    nullif(trim(payload->>'medium'), ''),
    nullif(trim(payload->>'referrer'), ''),
    coalesce(payload->'lead_source_details', '{}'::jsonb),
    nullif(trim(payload->>'customer_query'), ''),
    v_ip_address, v_user_agent, v_fingerprint,
    v_whatsapp_opt_in
  )
  RETURNING id INTO lead_id;

  RETURN lead_id;
END;
$$;

ALTER FUNCTION public.submit_lead(payload jsonb) OWNER TO postgres;

-- Trigger: gate WhatsApp job on whatsapp_opt_in.
CREATE OR REPLACE FUNCTION public.leads_enqueue_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    INSERT INTO public.notifications_queue (event_type, channel, recipient_email, payload)
    VALUES (
      'lead_ack',
      'email',
      NEW.email,
      jsonb_build_object('name', COALESCE(NEW.name, ''))
    );
  END IF;

  IF NEW.phone IS NOT NULL THEN
    INSERT INTO public.notifications_queue (event_type, channel, recipient_phone, payload)
    VALUES (
      'lead_ack',
      'sms',
      NEW.phone,
      jsonb_build_object('name', COALESCE(NEW.name, ''))
    );

    IF NEW.whatsapp_opt_in IS TRUE THEN
      INSERT INTO public.notifications_queue (event_type, channel, recipient_phone, payload)
      VALUES (
        'lead_ack',
        'whatsapp',
        NEW.phone,
        jsonb_build_object('name', COALESCE(NEW.name, ''))
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.leads_enqueue_notifications() OWNER TO postgres;
