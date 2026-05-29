/*
  # Add Reference URLs to Strategic Content

  1. Changes
    - Add `reference_url` column to `pod_assumptions` table
    - Add `reference_url` column to `assumption_forecasts` table
    - Add `reference_url` column to `assumption_scenarios` table
    - Add `reference_url` column to `assumption_risks` table
  
  2. Purpose
    - Allow users to attach source URLs and references to strategic content
    - Support evidence-based decision making with linkable sources
  
  3. Security
    - No RLS changes needed - inherits existing policies
*/

-- Add reference_url to pod_assumptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pod_assumptions' AND column_name = 'reference_url'
  ) THEN
    ALTER TABLE pod_assumptions ADD COLUMN reference_url text;
  END IF;
END $$;

-- Add reference_url to assumption_forecasts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assumption_forecasts' AND column_name = 'reference_url'
  ) THEN
    ALTER TABLE assumption_forecasts ADD COLUMN reference_url text;
  END IF;
END $$;

-- Add reference_url to assumption_scenarios
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assumption_scenarios' AND column_name = 'reference_url'
  ) THEN
    ALTER TABLE assumption_scenarios ADD COLUMN reference_url text;
  END IF;
END $$;

-- Add reference_url to assumption_risks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assumption_risks' AND column_name = 'reference_url'
  ) THEN
    ALTER TABLE assumption_risks ADD COLUMN reference_url text;
  END IF;
END $$;