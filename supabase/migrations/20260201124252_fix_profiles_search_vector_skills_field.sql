/*
  # Fix profiles search vector function
  
  1. Problem
    - The update_profiles_search_vector() function references NEW.skills
    - The profiles table doesn't have a skills column
    - Skills are stored in the separate user_skills table
  
  2. Solution
    - Update the function to only use fields that exist in profiles table
    - Use full_name, bio, about_me, and job_title for search indexing
  
  3. Security
    - Maintains SECURITY DEFINER and search_path settings
*/

-- Fix the profiles search vector function to remove non-existent skills field
CREATE OR REPLACE FUNCTION update_profiles_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.full_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.bio, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.about_me, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.job_title, '')), 'B');
  RETURN NEW;
END;
$$;

-- Update existing records with corrected search vectors
UPDATE profiles SET search_vector = 
  setweight(to_tsvector('english', COALESCE(full_name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(bio, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(about_me, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(job_title, '')), 'B')
WHERE search_vector IS NOT NULL;