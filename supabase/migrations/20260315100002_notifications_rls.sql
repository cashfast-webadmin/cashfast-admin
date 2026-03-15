-- RLS for notification tables.
-- notifications_queue: system-generated jobs only; no client inserts. Trigger (SECURITY DEFINER) inserts; service_role reads/updates.
-- notification_templates: admins manage via RBAC; service_role reads (Edge Function).

-- Prevent invalid notification rows (at least one recipient).
ALTER TABLE public.notifications_queue
  ADD CONSTRAINT notifications_queue_recipient_required
  CHECK (recipient_email IS NOT NULL OR recipient_phone IS NOT NULL);

ALTER TABLE public.notifications_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- notifications_queue: block all client inserts. Trigger uses SECURITY DEFINER (runs as owner), so RLS is bypassed for trigger inserts.
CREATE POLICY "no direct insert"
  ON public.notifications_queue
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- Worker (Edge Function with service_role) can read and update the queue.
CREATE POLICY "worker read"
  ON public.notifications_queue
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "worker can update"
  ON public.notifications_queue
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- notification_templates: only authenticated admins with permission can manage.
CREATE POLICY "admins manage templates"
  ON public.notification_templates
  FOR ALL
  TO authenticated
  USING (authz.has_permission('notification_templates.manage'))
  WITH CHECK (authz.has_permission('notification_templates.manage'));

-- Service role (Edge Function) can read templates.
CREATE POLICY "service role read"
  ON public.notification_templates
  FOR SELECT
  TO service_role
  USING (true);
