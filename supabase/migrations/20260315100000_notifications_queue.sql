-- Notifications queue: one row per channel (email, sms, whatsapp) per event.
-- Database webhook on INSERT invokes Edge Function to send via Resend / MSG91.
CREATE TABLE IF NOT EXISTS public.notifications_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  channel text NOT NULL,
  recipient_email text,
  recipient_phone text,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  retry_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT notifications_queue_channel_check CHECK (channel IN ('email', 'sms', 'whatsapp'))
);

COMMENT ON TABLE public.notifications_queue IS 'Outbound notification jobs; processed by Edge Function via Database Webhook.';

CREATE INDEX idx_notifications_queue_status_retry
  ON public.notifications_queue (status, retry_count)
  WHERE status = 'pending' AND retry_count < 3;

-- Optional: reusable templates per event + channel (subject/body for email; body for sms/whatsapp).
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  channel text NOT NULL,
  subject text,
  body text,
  UNIQUE (event_type, channel)
);

COMMENT ON TABLE public.notification_templates IS 'Templates for notification content per event_type and channel.';

-- Seed default lead acknowledgement templates (body only for sms/whatsapp).
INSERT INTO public.notification_templates (event_type, channel, subject, body)
VALUES
  ('lead_ack', 'email', 'Thanks for contacting Cashfast', 'Hi {{name}},\n\nThanks for your enquiry.\nOur loan expert will contact you shortly.'),
  ('lead_ack', 'sms', null, 'Thanks for contacting Cashfast. Our loan expert will contact you shortly.'),
  ('lead_ack', 'whatsapp', null, 'Thanks for contacting Cashfast, {{name}}. Our loan expert will contact you shortly.')
ON CONFLICT (event_type, channel) DO NOTHING;

-- Trigger: after lead insert, enqueue notification jobs (email, sms, whatsapp when phone present).
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

    -- WhatsApp: enqueue when phone present (whatsapp_opt_in gating added in later migration if column exists).
    INSERT INTO public.notifications_queue (event_type, channel, recipient_phone, payload)
    VALUES (
      'lead_ack',
      'whatsapp',
      NEW.phone,
      jsonb_build_object('name', COALESCE(NEW.name, ''))
    );
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.leads_enqueue_notifications() OWNER TO postgres;

CREATE TRIGGER leads_enqueue_notifications_trigger
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.leads_enqueue_notifications();
