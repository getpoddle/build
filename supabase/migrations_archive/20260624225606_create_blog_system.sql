
-- Blog posts table
CREATE TABLE blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  cover_image_url text,
  category text NOT NULL DEFAULT 'company' CHECK (category IN ('product-update','company','feature','use-case','about')),
  author_name text NOT NULL DEFAULT 'Poddle Team',
  author_avatar_url text,
  reading_time_minutes integer NOT NULL DEFAULT 3,
  is_published boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_blog_posts_slug ON blog_posts (slug);
CREATE INDEX idx_blog_posts_published ON blog_posts (is_published, published_at DESC);
CREATE INDEX idx_blog_posts_category ON blog_posts (category, is_published);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_blog_posts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_blog_posts_updated_at();

-- View count increment function (safe, no RLS bypass needed)
CREATE OR REPLACE FUNCTION increment_blog_view_count(post_slug text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE blog_posts SET view_count = view_count + 1 WHERE slug = post_slug AND is_published = true;
END;
$$;

-- RLS
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Public: read published posts
CREATE POLICY "blog_posts_public_read" ON blog_posts FOR SELECT
  TO anon, authenticated USING (is_published = true);

-- Admins: full access (using the admins table for auth check)
CREATE POLICY "blog_posts_admin_insert" ON blog_posts FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE id = auth.uid())
  );

CREATE POLICY "blog_posts_admin_update" ON blog_posts FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM admins WHERE id = auth.uid())
  );

CREATE POLICY "blog_posts_admin_delete" ON blog_posts FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE id = auth.uid())
  );

-- Admin can also read drafts
CREATE POLICY "blog_posts_admin_read_all" ON blog_posts FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE id = auth.uid())
  );
