/*
  # Add LinkedIn URL to profiles

  Adds a `linkedin_url` column to the `profiles` table so users can link
  their LinkedIn profile. Stored as nullable text.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'linkedin_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN linkedin_url text DEFAULT NULL;
  END IF;
END $$;
