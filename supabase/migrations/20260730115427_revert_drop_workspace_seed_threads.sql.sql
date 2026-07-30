-- ============================================================
-- REVERT: Drop the workspace_seed_threads config table
-- ============================================================
-- This table held canned example AI threads that were inserted into
-- new workspaces. The seed-thread feature has been removed; the table
-- is no longer referenced by any trigger or function.

DROP TABLE IF EXISTS public.workspace_seed_threads;
