/*
  # Decision Inbox System

  Tables:
  1. decision_inbox_profiles — per-user inbox config (slug, display name, bio, active flag)
  2. inbox_submissions        — anonymous submissions to an inbox owner
  3. inbox_briefs             — War Room output stored and shared as a brief

  Notes:
  - inbox_submissions allows anonymous INSERT (no auth required)
  - inbox_briefs can be read publicly by share_token (no auth required)
  - Owner reads/writes gated by auth.uid()
*/

-- 1. Add inbox_slug to profiles (unique per user, used in public URL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'inbox_slug'
  ) THEN
    ALTER TABLE profiles ADD COLUMN inbox_slug text UNIQUE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'inbox_active'
  ) THEN
    ALTER TABLE profiles ADD COLUMN inbox_active boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'inbox_display_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN inbox_display_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'inbox_bio'
  ) THEN
    ALTER TABLE profiles ADD COLUMN inbox_bio text;
  END IF;
END $$;

-- 2. inbox_submissions
CREATE TABLE IF NOT EXISTS inbox_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  decision text NOT NULL,
  options text NOT NULL DEFAULT '',
  context text NOT NULL DEFAULT '',
  submitter_name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'complete', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inbox_submissions ENABLE ROW LEVEL SECURITY;

-- Owner can see their own submissions
CREATE POLICY "owner_select_inbox_submissions" ON inbox_submissions
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

-- Anyone (including anon) can submit
CREATE POLICY "anon_insert_inbox_submissions" ON inbox_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Owner can update status
CREATE POLICY "owner_update_inbox_submissions" ON inbox_submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Owner can delete their submissions
CREATE POLICY "owner_delete_inbox_submissions" ON inbox_submissions
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- 3. inbox_briefs
CREATE TABLE IF NOT EXISTS inbox_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES inbox_submissions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  share_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  synthesis jsonb NOT NULL DEFAULT '{}',
  owner_note text,
  visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'shared')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inbox_briefs ENABLE ROW LEVEL SECURITY;

-- Owner sees all their briefs
CREATE POLICY "owner_select_inbox_briefs" ON inbox_briefs
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

-- Anyone can read a shared brief by token (handled via anon select + share_token filter)
CREATE POLICY "public_select_shared_inbox_briefs" ON inbox_briefs
  FOR SELECT TO anon, authenticated
  USING (visibility = 'shared');

CREATE POLICY "owner_insert_inbox_briefs" ON inbox_briefs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owner_update_inbox_briefs" ON inbox_briefs
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owner_delete_inbox_briefs" ON inbox_briefs
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inbox_submissions_owner_id ON inbox_submissions(owner_id);
CREATE INDEX IF NOT EXISTS idx_inbox_submissions_status ON inbox_submissions(status);
CREATE INDEX IF NOT EXISTS idx_inbox_briefs_owner_id ON inbox_briefs(owner_id);
CREATE INDEX IF NOT EXISTS idx_inbox_briefs_submission_id ON inbox_briefs(submission_id);
CREATE INDEX IF NOT EXISTS idx_inbox_briefs_share_token ON inbox_briefs(share_token);
CREATE INDEX IF NOT EXISTS idx_profiles_inbox_slug ON profiles(inbox_slug) WHERE inbox_slug IS NOT NULL;

-- Auto-set inbox_slug from username on update
CREATE OR REPLACE FUNCTION sync_inbox_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only auto-set slug if username exists and slug not already set
  IF NEW.inbox_slug IS NULL AND NEW.username IS NOT NULL THEN
    NEW.inbox_slug := lower(regexp_replace(NEW.username, '[^a-zA-Z0-9_-]', '', 'g'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_inbox_slug ON profiles;
CREATE TRIGGER set_inbox_slug
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_inbox_slug();

-- updated_at trigger for briefs
CREATE OR REPLACE FUNCTION update_inbox_brief_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_inbox_brief_updated_at ON inbox_briefs;
CREATE TRIGGER set_inbox_brief_updated_at
  BEFORE UPDATE ON inbox_briefs
  FOR EACH ROW EXECUTE FUNCTION update_inbox_brief_updated_at();
