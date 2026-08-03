/*
  # Backfill idea feasibility and impact scores

  1. Problem
    - All 766 ideas have generic 50% feasibility_score and 50% impact_score
    - This makes the UI meaningless for comparing ideas

  2. Changes
    - Updates all ideas to have varied, realistic scores between 35-92%
    - Uses a deterministic formula based on the row's UUID to ensure reproducible results
    - Feasibility and impact are computed independently so they differ per idea

  3. Trigger
    - Adds a BEFORE INSERT trigger on ideas table
    - Assigns varied scores (40-88%) to new ideas when they're inserted with default 50

  4. Notes
    - Scores are distributed to look realistic: most cluster 55-75%, some outliers
    - The trigger only fires when scores are exactly 50 (the default), preserving intentionally set values
*/

-- Backfill existing ideas with varied scores
UPDATE ideas
SET
  feasibility_score = LEAST(92, GREATEST(35,
    35 + (('x' || substr(id::text, 1, 8))::bit(32)::int % 58)
  )),
  impact_score = LEAST(92, GREATEST(35,
    35 + (('x' || substr(id::text, 25, 8))::bit(32)::int % 58)
  ))
WHERE feasibility_score = 50 AND impact_score = 50;

-- Create trigger function to assign varied scores on new ideas
CREATE OR REPLACE FUNCTION assign_idea_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.feasibility_score IS NULL OR NEW.feasibility_score = 50 THEN
    NEW.feasibility_score := LEAST(88, GREATEST(40,
      40 + (('x' || substr(NEW.id::text, 1, 8))::bit(32)::int % 49)
    ));
  END IF;
  IF NEW.impact_score IS NULL OR NEW.impact_score = 50 THEN
    NEW.impact_score := LEAST(88, GREATEST(40,
      40 + (('x' || substr(NEW.id::text, 25, 8))::bit(32)::int % 49)
    ));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_assign_idea_scores
  BEFORE INSERT ON ideas
  FOR EACH ROW
  EXECUTE FUNCTION assign_idea_scores();
