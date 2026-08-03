/*
  # Add insight_type to pod_assumptions

  1. Changes
    - Adds `insight_type` column to `pod_assumptions` table
    - Represents what kind of insight it is: Idea, Claim, Hypothesis, Prediction, Concern, Opportunity, General
    - Defaults to 'General' to avoid breaking existing rows
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pod_assumptions' AND column_name = 'insight_type'
  ) THEN
    ALTER TABLE pod_assumptions ADD COLUMN insight_type text NOT NULL DEFAULT 'General';
  END IF;
END $$;
