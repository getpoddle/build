/*
  # Force PostgREST Schema Cache Refresh

  1. Purpose
    - Force PostgREST to reload its schema cache so the `next_steps` column 
      on the `posts` table is properly exposed via the REST API
    - This addresses an issue where the column exists in the database but 
      may not be visible through the API due to stale schema cache

  2. Changes
    - Sends NOTIFY to pgrst channel to trigger schema reload
    - Adds a comment on the next_steps column to force schema detection
*/

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Add column comment to ensure PostgREST picks it up
COMMENT ON COLUMN public.posts.next_steps IS 'JSON array of actionable next steps for the post';
