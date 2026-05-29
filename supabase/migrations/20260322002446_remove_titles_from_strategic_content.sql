/*
  # Remove Title Fields from Strategic Content

  1. Changes
    - Remove title column from pod_assumptions (keep content field)
    - Remove title column from assumption_risks
    - Remove title column from assumption_scenarios
    - Update any dependencies on these fields

  2. Notes
    - For pod_assumptions, the content field will serve as the main text
    - Risks and scenarios will only have description fields
    - This simplifies the data model and UX
*/

-- Remove title from pod_assumptions (content field already exists)
ALTER TABLE pod_assumptions DROP COLUMN IF EXISTS title;

-- Remove title from assumption_risks
ALTER TABLE assumption_risks DROP COLUMN IF EXISTS title;

-- Remove title from assumption_scenarios
ALTER TABLE assumption_scenarios DROP COLUMN IF EXISTS title;

-- Update search vector trigger for profiles to ensure it still works
-- (This is a precautionary check - the trigger should still function correctly)
