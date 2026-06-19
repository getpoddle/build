-- Add free_workspace_month to profiles to track monthly free workspace entitlement.
-- Stores the YYYY-MM of the last month the user created a free workspace.
-- Null means they have never used their free monthly slot (or the feature pre-dates this column).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'free_workspace_month'
  ) THEN
    ALTER TABLE profiles ADD COLUMN free_workspace_month text;
  END IF;
END $$;
