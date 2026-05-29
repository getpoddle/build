/*
  # Create Unified Search System

  1. Overview
    - Implements full-text search across multiple entity types
    - Uses PostgreSQL's built-in tsvector for efficient searching
    - Supports searching profiles, posts, pods, jobs, and marketplace items

  2. Changes
    - Add search_vector tsvector columns to relevant tables
    - Create GIN indexes for fast full-text search
    - Create triggers to automatically update search vectors
    - Provides ranked search results using ts_rank

  3. Search Capabilities
    - Profiles: Search by full_name and bio
    - Posts: Search by content
    - Pods: Search by name and description
    - Jobs: Search by title, company, description, and requirements
    - Marketplace: Search by title and description

  4. Performance
    - GIN indexes ensure fast search performance
    - Automatic triggers keep search vectors up-to-date
    - Weighted search prioritizes titles/names over descriptions
*/

-- Add search vector columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Add search vector columns to posts
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Add search vector columns to pods
ALTER TABLE pods 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Add search vector columns to jobs
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Add search vector columns to marketplace_items
ALTER TABLE marketplace_items 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN indexes for fast full-text search
CREATE INDEX IF NOT EXISTS profiles_search_idx ON profiles USING gin(search_vector);
CREATE INDEX IF NOT EXISTS posts_search_idx ON posts USING gin(search_vector);
CREATE INDEX IF NOT EXISTS pods_search_idx ON pods USING gin(search_vector);
CREATE INDEX IF NOT EXISTS jobs_search_idx ON jobs USING gin(search_vector);
CREATE INDEX IF NOT EXISTS marketplace_items_search_idx ON marketplace_items USING gin(search_vector);

-- Function to update profiles search vector
CREATE OR REPLACE FUNCTION update_profiles_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.full_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.bio, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update posts search vector
CREATE OR REPLACE FUNCTION update_posts_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'A');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update pods search vector
CREATE OR REPLACE FUNCTION update_pods_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update jobs search vector
CREATE OR REPLACE FUNCTION update_jobs_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.company, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.requirements, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update marketplace_items search vector
CREATE OR REPLACE FUNCTION update_marketplace_items_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic search vector updates
DROP TRIGGER IF EXISTS profiles_search_vector_update ON profiles;
CREATE TRIGGER profiles_search_vector_update
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_search_vector();

DROP TRIGGER IF EXISTS posts_search_vector_update ON posts;
CREATE TRIGGER posts_search_vector_update
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_posts_search_vector();

DROP TRIGGER IF EXISTS pods_search_vector_update ON pods;
CREATE TRIGGER pods_search_vector_update
  BEFORE INSERT OR UPDATE ON pods
  FOR EACH ROW
  EXECUTE FUNCTION update_pods_search_vector();

DROP TRIGGER IF EXISTS jobs_search_vector_update ON jobs;
CREATE TRIGGER jobs_search_vector_update
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_jobs_search_vector();

DROP TRIGGER IF EXISTS marketplace_items_search_vector_update ON marketplace_items;
CREATE TRIGGER marketplace_items_search_vector_update
  BEFORE INSERT OR UPDATE ON marketplace_items
  FOR EACH ROW
  EXECUTE FUNCTION update_marketplace_items_search_vector();

-- Update existing records with search vectors
UPDATE profiles SET search_vector = 
  setweight(to_tsvector('english', COALESCE(full_name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(bio, '')), 'B')
WHERE search_vector IS NULL;

UPDATE posts SET search_vector = 
  setweight(to_tsvector('english', COALESCE(content, '')), 'A')
WHERE search_vector IS NULL;

UPDATE pods SET search_vector = 
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B')
WHERE search_vector IS NULL;

UPDATE jobs SET search_vector = 
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(company, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(requirements, '')), 'C')
WHERE search_vector IS NULL;

UPDATE marketplace_items SET search_vector = 
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B')
WHERE search_vector IS NULL;