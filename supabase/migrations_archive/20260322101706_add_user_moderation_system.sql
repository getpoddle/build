/*
  # Add User Moderation System

  1. New Tables
    - `user_account_status` - Track account suspension, bans, and status
      - `user_id` (uuid, primary key, references profiles)
      - `status` (text) - 'active', 'suspended', 'banned'
      - `reason` (text) - Reason for status change
      - `suspended_until` (timestamptz) - When temporary suspension ends
      - `suspended_by` (uuid) - Admin who made the change
      - `suspended_at` (timestamptz) - When status was changed
      - `notes` (text) - Additional admin notes
    
    - `content_reports` - User-reported content violations
      - `id` (uuid, primary key)
      - `reporter_id` (uuid, references profiles) - User who reported
      - `reported_user_id` (uuid, references profiles) - User being reported
      - `content_type` (text) - 'post', 'comment', 'assumption', 'challenge', etc.
      - `content_id` (uuid) - ID of the reported content
      - `reason` (text) - Report reason
      - `description` (text) - Detailed description
      - `status` (text) - 'pending', 'reviewed', 'resolved', 'dismissed'
      - `reviewed_by` (uuid) - Admin who reviewed
      - `reviewed_at` (timestamptz) - When it was reviewed
      - `admin_notes` (text) - Admin notes on the report
      - `created_at` (timestamptz)
    
    - `moderation_actions` - Log of all moderation actions
      - `id` (uuid, primary key)
      - `admin_id` (uuid, references profiles) - Admin who took action
      - `target_user_id` (uuid, references profiles) - User affected
      - `action_type` (text) - 'suspend', 'ban', 'warn', 'content_remove', etc.
      - `reason` (text)
      - `details` (jsonb) - Additional action details
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Only admins can read/write moderation data
    - Users cannot see their own moderation status details
    - Content reports can be created by any authenticated user
    - Only admins can view/update reports

  3. Indexes
    - Index on user_account_status(user_id, status)
    - Index on content_reports(status, created_at)
    - Index on moderation_actions(target_user_id, created_at)
*/

-- Create user_account_status table
CREATE TABLE IF NOT EXISTS public.user_account_status (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  reason text,
  suspended_until timestamptz,
  suspended_by uuid REFERENCES public.profiles(id),
  suspended_at timestamptz DEFAULT now(),
  notes text,
  updated_at timestamptz DEFAULT now()
);

-- Create content_reports table
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('post', 'comment', 'assumption', 'challenge', 'challenge_response', 'message', 'profile')),
  content_id uuid,
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate_speech', 'misinformation', 'inappropriate', 'other')),
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz DEFAULT now()
);

-- Create moderation_actions table
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('suspend', 'unsuspend', 'ban', 'unban', 'warn', 'content_remove', 'verify', 'unverify')),
  reason text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_account_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_account_status
CREATE POLICY "Admins can view all account statuses"
  ON public.user_account_status FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert account statuses"
  ON public.user_account_status FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update account statuses"
  ON public.user_account_status FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- RLS Policies for content_reports
CREATE POLICY "Users can create reports"
  ON public.content_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
  ON public.content_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports"
  ON public.content_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update reports"
  ON public.content_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- RLS Policies for moderation_actions
CREATE POLICY "Admins can view all moderation actions"
  ON public.moderation_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert moderation actions"
  ON public.moderation_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_account_status_user_status ON public.user_account_status(user_id, status);
CREATE INDEX IF NOT EXISTS idx_content_reports_status_created ON public.content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON public.content_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_reported_user ON public.content_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_target_user ON public.moderation_actions(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_admin ON public.moderation_actions(admin_id, created_at DESC);

-- Function to initialize account status for existing users
DO $$
BEGIN
  INSERT INTO public.user_account_status (user_id, status)
  SELECT id, 'active'
  FROM public.profiles
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_account_status WHERE user_id = profiles.id
  );
END $$;

-- Trigger to create account status for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_account_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_account_status (user_id, status)
  VALUES (NEW.id, 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_account_status
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_account_status();
