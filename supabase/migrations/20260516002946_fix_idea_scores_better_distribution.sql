/*
  # Fix idea score distribution

  1. Problem
    - Too many scores clustered at the floor (35%) due to negative modulo results
  
  2. Changes
    - Re-computes all feasibility and impact scores using abs() for better spread
    - Updates trigger function to use the same improved formula
    - Scores now range 38-92% with good variation
*/

UPDATE ideas
SET
  feasibility_score = 38 + abs(('x' || substr(id::text, 1, 8))::bit(32)::int % 55),
  impact_score = 38 + abs(('x' || substr(id::text, 25, 8))::bit(32)::int % 55);

CREATE OR REPLACE FUNCTION assign_idea_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.feasibility_score IS NULL OR NEW.feasibility_score = 50 THEN
    NEW.feasibility_score := 38 + abs(('x' || substr(NEW.id::text, 1, 8))::bit(32)::int % 55);
  END IF;
  IF NEW.impact_score IS NULL OR NEW.impact_score = 50 THEN
    NEW.impact_score := 38 + abs(('x' || substr(NEW.id::text, 25, 8))::bit(32)::int % 55);
  END IF;
  RETURN NEW;
END;
$$;
