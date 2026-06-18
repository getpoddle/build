-- Remove decision inbox system tables and profile columns

DROP TABLE IF EXISTS inbox_briefs CASCADE;
DROP TABLE IF EXISTS inbox_submissions CASCADE;

-- Remove inbox-related columns from profiles
ALTER TABLE profiles
  DROP COLUMN IF EXISTS inbox_slug,
  DROP COLUMN IF EXISTS inbox_active,
  DROP COLUMN IF EXISTS inbox_display_name,
  DROP COLUMN IF EXISTS inbox_bio;
