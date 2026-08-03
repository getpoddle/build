/*
  # Add next_steps to ai_thread_recommendations

  ## Changes
  - Adds a `next_steps` column (text array) to the `ai_thread_recommendations` table
    to store actionable suggestions the AI generates for the decision thread

  ## Notes
  - Safe, additive migration — no data is removed
  - Default is an empty array so existing rows are unaffected
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_thread_recommendations' AND column_name = 'next_steps'
  ) THEN
    ALTER TABLE ai_thread_recommendations ADD COLUMN next_steps text[] DEFAULT '{}';
  END IF;
END $$;
