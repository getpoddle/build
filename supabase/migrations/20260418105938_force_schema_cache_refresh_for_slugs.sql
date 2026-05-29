/*
  # Force PostgREST schema cache refresh

  1. Changes
    - Forces PostgREST to reload its schema cache
    - Ensures new `slug` columns on `posts` and `ai_agent_discussions` are visible to the API

  2. Important Notes
    - This is needed after adding new columns to ensure the REST API can query them
*/

NOTIFY pgrst, 'reload schema';

SELECT 1;