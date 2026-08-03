/*
  # Enhance Pod Assumptions Schema

  ## Changes
  1. Add title, description, and category columns to pod_assumptions table
  2. Make content column nullable since we'll use description for detailed text
  3. Migrate existing content to title column

  ## Migration Strategy
  - Add new columns
  - Copy existing content to title
  - Keep content column for backwards compatibility
*/

-- Add new columns to pod_assumptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pod_assumptions' AND column_name = 'title'
  ) THEN
    ALTER TABLE pod_assumptions ADD COLUMN title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pod_assumptions' AND column_name = 'description'
  ) THEN
    ALTER TABLE pod_assumptions ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pod_assumptions' AND column_name = 'category'
  ) THEN
    ALTER TABLE pod_assumptions ADD COLUMN category text DEFAULT 'General';
  END IF;
END $$;

-- Migrate existing content to title if title is null
UPDATE pod_assumptions
SET title = content
WHERE title IS NULL OR title = '';

-- Set default description if empty
UPDATE pod_assumptions
SET description = content
WHERE description IS NULL OR description = '';

-- Set default category
UPDATE pod_assumptions
SET category = 'General'
WHERE category IS NULL OR category = '';
