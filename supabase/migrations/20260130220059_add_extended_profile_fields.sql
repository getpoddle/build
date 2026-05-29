/*
  # Add Extended Profile Fields

  1. New Columns
    - `about_me` (text) - Extended biography/about section for user profiles
    - `job_title` (text) - Current job title or desired position
    - `certifications` (jsonb) - Array of certifications with structured data
      - Example: [{"name": "AWS Certified", "issuer": "Amazon", "year": "2023"}]
    - `job_experience` (jsonb) - Array of work experience entries
      - Example: [{"company": "Acme Corp", "title": "Developer", "start": "2020", "end": "2023", "description": "Built apps"}]
    - `education` (jsonb) - Array of education entries
      - Example: [{"institution": "MIT", "degree": "BS Computer Science", "start": "2016", "end": "2020"}]

  2. Notes
    - All fields are nullable to allow gradual profile completion
    - Using JSONB for structured arrays allows flexibility in data structure
    - Existing RLS policies will apply to these new columns
*/

-- Add extended profile fields to profiles table
DO $$
BEGIN
  -- Add about_me field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'about_me'
  ) THEN
    ALTER TABLE profiles ADD COLUMN about_me text;
  END IF;

  -- Add job_title field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'job_title'
  ) THEN
    ALTER TABLE profiles ADD COLUMN job_title text;
  END IF;

  -- Add certifications field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'certifications'
  ) THEN
    ALTER TABLE profiles ADD COLUMN certifications jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add job_experience field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'job_experience'
  ) THEN
    ALTER TABLE profiles ADD COLUMN job_experience jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add education field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'education'
  ) THEN
    ALTER TABLE profiles ADD COLUMN education jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;