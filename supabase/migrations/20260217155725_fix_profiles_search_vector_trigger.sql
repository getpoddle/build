/*
  # Fix Profiles Search Vector Trigger

  1. Problem
    - The trigger function references non-existent columns (role, company, skills)
    - This causes profile updates to fail silently
  
  2. Solution
    - Update trigger to only use columns that actually exist in the profiles table
    - Include: full_name, bio, job_title, about_me, country, location
  
  3. Security
    - No RLS changes needed
*/

-- Fix the search vector trigger function to use only existing columns
CREATE OR REPLACE FUNCTION update_profiles_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.full_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.bio, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.job_title, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.about_me, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.country, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.location, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
