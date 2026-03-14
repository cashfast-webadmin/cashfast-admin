-- public.faqs: admin-managed FAQ entries for the website (read by anon for pre-render/ISR)
CREATE TABLE IF NOT EXISTS public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.faqs OWNER TO postgres;
COMMENT ON TABLE public.faqs IS 'FAQ entries for the public website; managed in admin.';

CREATE INDEX IF NOT EXISTS idx_faqs_sort_order ON public.faqs (sort_order);

CREATE OR REPLACE FUNCTION public.faqs_set_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.faqs_set_updated() OWNER TO postgres;

CREATE TRIGGER faqs_set_updated
  BEFORE UPDATE ON public.faqs
  FOR EACH ROW
  EXECUTE FUNCTION public.faqs_set_updated();

-- RLS: public read (anon + authenticated) for website; write only with faqs.manage
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read faqs"
  ON public.faqs
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins with faqs.manage can insert"
  ON public.faqs
  FOR INSERT
  TO authenticated
  WITH CHECK (authz.has_permission('faqs.manage'));

CREATE POLICY "Admins with faqs.manage can update"
  ON public.faqs
  FOR UPDATE
  TO authenticated
  USING (authz.has_permission('faqs.manage'))
  WITH CHECK (authz.has_permission('faqs.manage'));

CREATE POLICY "Admins with faqs.manage can delete"
  ON public.faqs
  FOR DELETE
  TO authenticated
  USING (authz.has_permission('faqs.manage'));

-- Permission and role assignment so admin can manage FAQs (idempotent)
INSERT INTO authz.permissions (name)
VALUES ('faqs.manage')
ON CONFLICT (name) DO NOTHING;

INSERT INTO authz.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM authz.roles r
CROSS JOIN authz.permissions p
WHERE r.name = 'super_admin'
  AND p.name = 'faqs.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO authz.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM authz.roles r
CROSS JOIN authz.permissions p
WHERE r.name = 'admin'
  AND p.name = 'faqs.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
