/*
  # Add Location Fields to Profiles

  1. Changes
    - Add `country` column to profiles table (text, optional)
    - Add `location` column to profiles table (text for city/state, optional)
    - Update search vector to include location fields for better discoverability
  
  2. Security
    - No RLS changes needed - existing policies cover these fields
  
  3. Notes
    - Country will store full country name
    - Location will store city/state or region
    - Both fields are optional to not break existing profiles
*/

-- Add location fields to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'country'
  ) THEN
    ALTER TABLE profiles ADD COLUMN country text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'location'
  ) THEN
    ALTER TABLE profiles ADD COLUMN location text;
  END IF;
END $$;

-- Update the search vector trigger function to include location fields
CREATE OR REPLACE FUNCTION update_profiles_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.full_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.bio, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.role, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.company, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.skills, ' '), '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.country, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.location, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;