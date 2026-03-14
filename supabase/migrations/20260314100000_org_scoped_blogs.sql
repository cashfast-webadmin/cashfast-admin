-- public.blogs: organization-scoped blog CMS with public published reads

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'blog_status'
  ) THEN
    CREATE TYPE public.blog_status AS ENUM ('draft', 'published', 'archived');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.blogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES authz.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  excerpt text,
  content text NOT NULL,
  featured_image text,
  seo_title text,
  seo_description text,
  status public.blog_status NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blogs_org_slug_unique UNIQUE (organization_id, slug),
  CONSTRAINT blogs_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT blogs_publish_state CHECK (
    (status = 'published' AND published_at IS NOT NULL)
    OR (status <> 'published')
  )
);

ALTER TABLE public.blogs OWNER TO postgres;
COMMENT ON TABLE public.blogs IS 'Organization-scoped blog posts. Public can read published posts.';

CREATE TABLE IF NOT EXISTS public.blog_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES authz.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_tags_org_slug_unique UNIQUE (organization_id, slug)
);

ALTER TABLE public.blog_tags OWNER TO postgres;
COMMENT ON TABLE public.blog_tags IS 'Organization-scoped tags for blogs.';

CREATE TABLE IF NOT EXISTS public.blog_post_tags (
  blog_id uuid NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blog_id, tag_id)
);

ALTER TABLE public.blog_post_tags OWNER TO postgres;
COMMENT ON TABLE public.blog_post_tags IS 'Mapping table between blogs and tags.';

CREATE INDEX IF NOT EXISTS idx_blogs_org_status_published
  ON public.blogs (organization_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blogs_slug ON public.blogs (slug);
CREATE INDEX IF NOT EXISTS idx_blogs_published_only
  ON public.blogs (published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_blog_tags_org_slug ON public.blog_tags (organization_id, slug);
CREATE INDEX IF NOT EXISTS idx_blog_post_tags_blog ON public.blog_post_tags (blog_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_tags_tag ON public.blog_post_tags (tag_id);

CREATE OR REPLACE FUNCTION public.blogs_set_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.slug IS NOT NULL THEN
    NEW.slug := lower(NEW.slug);
  END IF;
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  IF NEW.status <> 'published' THEN
    NEW.published_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.blogs_set_updated() OWNER TO postgres;

CREATE OR REPLACE FUNCTION public.blog_tags_set_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.slug IS NOT NULL THEN
    NEW.slug := lower(NEW.slug);
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.blog_tags_set_updated() OWNER TO postgres;

DROP TRIGGER IF EXISTS blogs_set_updated ON public.blogs;
CREATE TRIGGER blogs_set_updated
  BEFORE INSERT OR UPDATE ON public.blogs
  FOR EACH ROW
  EXECUTE FUNCTION public.blogs_set_updated();

DROP TRIGGER IF EXISTS blog_tags_set_updated ON public.blog_tags;
CREATE TRIGGER blog_tags_set_updated
  BEFORE INSERT OR UPDATE ON public.blog_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.blog_tags_set_updated();

ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_tags ENABLE ROW LEVEL SECURITY;

-- Public reads of published posts, org members can read all own org posts.
CREATE POLICY "Anyone can read published blogs"
  ON public.blogs
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    OR authz.is_org_member(organization_id)
    OR authz.has_permission('blogs.read')
    OR authz.has_permission('blogs.manage')
    OR authz.is_super_admin()
  );

CREATE POLICY "Org admins can insert blogs"
  ON public.blogs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    authz.has_permission('blogs.manage')
    AND (authz.is_org_member(organization_id) OR authz.is_super_admin())
  );

CREATE POLICY "Org admins can update blogs"
  ON public.blogs
  FOR UPDATE
  TO authenticated
  USING (
    authz.has_permission('blogs.manage')
    AND (authz.is_org_member(organization_id) OR authz.is_super_admin())
  )
  WITH CHECK (
    authz.has_permission('blogs.manage')
    AND (authz.is_org_member(organization_id) OR authz.is_super_admin())
  );

CREATE POLICY "Org admins can delete blogs"
  ON public.blogs
  FOR DELETE
  TO authenticated
  USING (
    authz.has_permission('blogs.manage')
    AND (authz.is_org_member(organization_id) OR authz.is_super_admin())
  );

-- Tag policies mirror blog policies with org scoping.
CREATE POLICY "Anyone can read published blog tags"
  ON public.blog_tags
  FOR SELECT
  TO anon, authenticated
  USING (
    authz.is_org_member(organization_id)
    OR authz.has_permission('blogs.read')
    OR authz.has_permission('blogs.manage')
    OR authz.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.blog_post_tags bpt
      JOIN public.blogs b ON b.id = bpt.blog_id
      WHERE bpt.tag_id = blog_tags.id
        AND b.status = 'published'
    )
  );

CREATE POLICY "Org admins can insert blog tags"
  ON public.blog_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    authz.has_permission('blogs.manage')
    AND (authz.is_org_member(organization_id) OR authz.is_super_admin())
  );

CREATE POLICY "Org admins can update blog tags"
  ON public.blog_tags
  FOR UPDATE
  TO authenticated
  USING (
    authz.has_permission('blogs.manage')
    AND (authz.is_org_member(organization_id) OR authz.is_super_admin())
  )
  WITH CHECK (
    authz.has_permission('blogs.manage')
    AND (authz.is_org_member(organization_id) OR authz.is_super_admin())
  );

CREATE POLICY "Org admins can delete blog tags"
  ON public.blog_tags
  FOR DELETE
  TO authenticated
  USING (
    authz.has_permission('blogs.manage')
    AND (authz.is_org_member(organization_id) OR authz.is_super_admin())
  );

CREATE POLICY "Anyone can read published blog tag mappings"
  ON public.blog_post_tags
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.blogs b
      WHERE b.id = blog_post_tags.blog_id
        AND (
          b.status = 'published'
          OR authz.is_org_member(b.organization_id)
          OR authz.has_permission('blogs.read')
          OR authz.has_permission('blogs.manage')
          OR authz.is_super_admin()
        )
    )
  );

CREATE POLICY "Org admins can insert blog tag mappings"
  ON public.blog_post_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.blogs b
      WHERE b.id = blog_post_tags.blog_id
        AND authz.has_permission('blogs.manage')
        AND (authz.is_org_member(b.organization_id) OR authz.is_super_admin())
    )
  );

CREATE POLICY "Org admins can delete blog tag mappings"
  ON public.blog_post_tags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.blogs b
      WHERE b.id = blog_post_tags.blog_id
        AND authz.has_permission('blogs.manage')
        AND (authz.is_org_member(b.organization_id) OR authz.is_super_admin())
    )
  );

-- Permissions and role assignment (idempotent)
INSERT INTO authz.permissions (name)
VALUES ('blogs.manage'), ('blogs.read')
ON CONFLICT (name) DO NOTHING;

INSERT INTO authz.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM authz.roles r
CROSS JOIN authz.permissions p
WHERE r.name = 'super_admin'
  AND p.name IN ('blogs.manage', 'blogs.read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO authz.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM authz.roles r
CROSS JOIN authz.permissions p
WHERE r.name = 'admin'
  AND p.name IN ('blogs.manage', 'blogs.read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO authz.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM authz.roles r
CROSS JOIN authz.permissions p
WHERE r.name = 'member'
  AND p.name IN ('blogs.manage', 'blogs.read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO authz.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM authz.roles r
CROSS JOIN authz.permissions p
WHERE r.name = 'viewer'
  AND p.name IN ('blogs.read')
ON CONFLICT (role_id, permission_id) DO NOTHING;
