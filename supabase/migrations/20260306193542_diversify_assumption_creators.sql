/*
  # Diversify Assumption Creators
  
  1. Changes
    - Redistributes all pod_assumptions to be created by different users
    - Ensures assumptions are spread across the user base rather than all by one user
    - Maintains data integrity by preserving assumption content and relationships
  
  2. Notes
    - Updates existing assumptions with random user assignments
    - Preserves all assumption content, forecasts, risks, scenarios, and challenges
*/

-- Reassign assumptions to different users randomly
DO $$
DECLARE
  assumption_record RECORD;
  random_user_id uuid;
BEGIN
  FOR assumption_record IN SELECT id FROM pod_assumptions LOOP
    -- Get a random user
    SELECT id INTO random_user_id FROM profiles ORDER BY random() LIMIT 1;
    
    -- Update the assumption's creator
    UPDATE pod_assumptions 
    SET created_by = random_user_id 
    WHERE id = assumption_record.id;
  END LOOP;
END $$;
