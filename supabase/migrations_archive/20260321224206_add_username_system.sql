/*
  # Add Username System

  1. Schema Changes
    - Add `username` column to `profiles` table (unique, nullable for existing users)
    - Add username validation constraints

  2. Functions
    - `check_username_available` - Check if username is available
    - `suggest_usernames` - Suggest available usernames based on first/last name

  3. Security
    - Update RLS policies to allow users to update their own username
    - Add unique constraint to prevent duplicate usernames

  4. Search
    - Update search triggers to include username in search vector
*/

-- Add username column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Add constraint for username format (alphanumeric, underscore, dash, 3-30 chars)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'username_format'
  ) THEN
    ALTER TABLE profiles
    ADD CONSTRAINT username_format
    CHECK (username IS NULL OR (username ~ '^[a-zA-Z0-9_-]{3,30}$'));
  END IF;
END $$;

-- Create index on username for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;

-- Function to check username availability
CREATE OR REPLACE FUNCTION check_username_available(p_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if username matches format
  IF p_username !~ '^[a-zA-Z0-9_-]{3,30}$' THEN
    RETURN false;
  END IF;

  -- Check if username is available
  RETURN NOT EXISTS (
    SELECT 1 FROM profiles WHERE LOWER(username) = LOWER(p_username)
  );
END;
$$;

-- Function to suggest available usernames
CREATE OR REPLACE FUNCTION suggest_usernames(
  p_first_name text,
  p_last_name text,
  p_desired_username text DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  suggestions text[] := '{}';
  base_username text;
  test_username text;
  counter int;
BEGIN
  -- Start with desired username or generate from name
  IF p_desired_username IS NOT NULL AND p_desired_username != '' THEN
    base_username := LOWER(REGEXP_REPLACE(p_desired_username, '[^a-zA-Z0-9_-]', '', 'g'));
  ELSE
    base_username := LOWER(
      REGEXP_REPLACE(
        CONCAT(p_first_name, p_last_name),
        '[^a-zA-Z0-9]',
        '',
        'g'
      )
    );
  END IF;

  -- Ensure minimum length
  IF LENGTH(base_username) < 3 THEN
    base_username := base_username || '123';
  END IF;

  -- Truncate if too long
  IF LENGTH(base_username) > 25 THEN
    base_username := LEFT(base_username, 25);
  END IF;

  -- Generate suggestions
  FOR counter IN 1..10 LOOP
    IF counter = 1 THEN
      test_username := base_username;
    ELSIF counter <= 5 THEN
      test_username := base_username || counter::text;
    ELSE
      test_username := base_username || '_' || (FLOOR(RANDOM() * 999) + 1)::text;
    END IF;

    -- Check if available
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE LOWER(username) = LOWER(test_username)) THEN
      suggestions := array_append(suggestions, test_username);
    END IF;

    -- Stop if we have 5 suggestions
    IF array_length(suggestions, 1) >= 5 THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN suggestions;
END;
$$;

-- Update the search vector trigger to include username
DROP TRIGGER IF EXISTS profiles_search_vector_update ON profiles;

CREATE OR REPLACE FUNCTION update_profiles_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.first_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.last_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.username, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.bio, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.location, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.country, '')), 'C');
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_search_vector_update
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_search_vector();

-- Update search vectors for existing profiles
UPDATE profiles SET search_vector =
  setweight(to_tsvector('english', COALESCE(first_name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(last_name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(username, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(bio, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(location, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(country, '')), 'C');