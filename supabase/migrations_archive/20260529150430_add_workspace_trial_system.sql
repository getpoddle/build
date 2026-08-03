/*
  # Add Workspace Free Trial System

  ## Summary
  Enables a 2-workspace free trial for all users. Each user can create or join up to 2
  trial workspaces at no cost. Trial workspaces have full Pro features for 30 days, after
  which they automatically go read-only (subscription_status → 'inactive').

  ## Changes

  ### Modified Tables
  - `profiles`
    - `trial_workspace_count` (integer, default 0): tracks how many trial workspaces the
      user has consumed — incremented both when creating and when joining a trial workspace
      via invite.

  - `workspaces`
    - `trial_workspace_expires_at` (timestamptz, nullable): set to NOW() + 30 days when a
      workspace is created on the free trial path. NULL for paid (Stripe) workspaces.
      Used by the daily cron job to detect expired trials.

  ## Automation
  - Registers a pg_cron job (`expire_trial_workspaces`) running daily at 03:00 UTC.
    It sets subscription_status = 'inactive' on any trialing workspace whose
    trial_workspace_expires_at has passed and which has no Stripe subscription attached.

  ## Security
  - No RLS changes needed — new columns inherit existing table policies.
  - The cron job runs as a privileged background task, not via user sessions.

  ## Notes
  1. `trial_workspace_count` counts slots consumed, not current active workspaces —
     even if a user leaves a trial workspace the count stays the same.
  2. Paid workspaces (stripe_subscription_id IS NOT NULL) are never expired by the cron.
  3. The 30-day window starts at workspace creation time.
*/

-- 1. Add trial_workspace_count to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'trial_workspace_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN trial_workspace_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2. Add trial_workspace_expires_at to workspaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspaces' AND column_name = 'trial_workspace_expires_at'
  ) THEN
    ALTER TABLE workspaces ADD COLUMN trial_workspace_expires_at timestamptz;
  END IF;
END $$;

-- 3. Daily cron job to expire trial workspaces that have passed their expiry date
-- Requires pg_cron extension (already enabled in Supabase)
SELECT cron.schedule(
  'expire_trial_workspaces',
  '0 3 * * *',
  $$
    UPDATE workspaces
    SET subscription_status = 'inactive'
    WHERE subscription_status = 'trialing'
      AND trial_workspace_expires_at IS NOT NULL
      AND trial_workspace_expires_at < NOW()
      AND stripe_subscription_id IS NULL;
  $$
);
