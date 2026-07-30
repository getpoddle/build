/*
  # Update Trial System: 7-day trial, 3 workspaces allowed

  ## Summary
  Replaces the previous 30-day / 1-per-month trial with a 7-day trial
  allowing up to 3 trial workspaces per user. The trial_workspace_count
  column on profiles already exists; we just change the enforcement
  semantics and the cron job.

  ## Changes
  1. Reschedule the expire_trial_workspaces cron to run hourly (so
     7-day trials expire promptly rather than waiting up to 24h).
  2. The cron SQL itself is unchanged — it already sets
     subscription_status = 'inactive' for trialing workspaces past
     their trial_workspace_expires_at.
  3. Drop the free_workspace_month column — no longer needed since
     we track via trial_workspace_count (cap = 3) instead of a
     monthly 1-workspace gate.

  ## Notes
  - trial_workspace_count counts slots consumed, not current active
    workspaces — even if a user leaves a trial workspace the count
    stays the same.
  - Paid workspaces (stripe_subscription_id IS NOT NULL) are never
    expired by the cron.
  - The 7-day window starts at workspace creation time.
*/

-- 1. Reschedule the cron to run hourly for tighter 7-day expiry
SELECT cron.unschedule('expire_trial_workspaces');
SELECT cron.schedule(
  'expire_trial_workspaces',
  '0 * * * *',
  $$
    UPDATE workspaces
    SET subscription_status = 'inactive'
    WHERE subscription_status = 'trialing'
      AND trial_workspace_expires_at IS NOT NULL
      AND trial_workspace_expires_at < NOW()
      AND stripe_subscription_id IS NULL;
  $$
);

-- 2. Drop the free_workspace_month column (replaced by trial_workspace_count cap of 3)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'free_workspace_month'
  ) THEN
    ALTER TABLE profiles DROP COLUMN free_workspace_month;
  END IF;
END $$;