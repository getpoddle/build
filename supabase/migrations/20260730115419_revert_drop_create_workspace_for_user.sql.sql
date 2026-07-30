-- ============================================================
-- REVERT: Drop the create_workspace_for_user helper function
-- ============================================================
-- This function was added to share workspace-creation logic between
-- the signup and email-confirmation triggers. Now that both triggers
-- have been reverted, it is no longer needed.

DROP FUNCTION IF EXISTS public.create_workspace_for_user(uuid, jsonb, timestamptz);
