/*
  # Add theme_preference to profiles

  1. Changes
    - Adds `theme_preference` column to `profiles` table
    - Stores the user's chosen app appearance: 'light' or 'dark'
    - Defaults to 'light' to preserve existing experience

  2. Notes
    - No RLS changes needed — existing profile update policies cover this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'theme_preference'
  ) THEN
    ALTER TABLE profiles ADD COLUMN theme_preference text NOT NULL DEFAULT 'light'
      CHECK (theme_preference IN ('light', 'dark'));
  END IF;
END $$;
