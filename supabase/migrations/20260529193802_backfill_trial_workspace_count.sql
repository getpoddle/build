/*
  # Backfill trial_workspace_count for existing users

  ## Summary
  The trial system was introduced after many workspaces already existed, so
  trial_workspace_count was never incremented for pre-migration workspace owners.
  This migration sets trial_workspace_count to the actual number of workspaces
  each free-tier user owns, ensuring the 2-workspace limit is correctly enforced
  going forward.

  ## Changes
  - `profiles.trial_workspace_count`: updated for all free-tier users (subscription_tier = 'free'
    or NULL) to reflect their actual owned workspace count where the current stored
    value is lower than reality.

  ## Notes
  1. Only free-tier users are updated — pro/enterprise users bypass the trial limit entirely.
  2. We use GREATEST() so we never decrease a count that was already correctly tracked.
  3. Safe to run multiple times (idempotent).
*/

UPDATE profiles p
SET trial_workspace_count = GREATEST(
  p.trial_workspace_count,
  (
    SELECT COUNT(*)::integer
    FROM workspaces w
    WHERE w.owner_id = p.id
  )
)
WHERE (p.subscription_tier = 'free' OR p.subscription_tier IS NULL);
