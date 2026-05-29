/*
  # Force Complete Schema Reload

  1. Problem
    - PostgREST schema cache still showing old 'title' column
    - Previous NOTIFY may not have been processed

  2. Solution
    - Drop and recreate all triggers on pod_assumptions to force schema refresh
    - Send multiple NOTIFY signals to ensure PostgREST picks up changes
*/

-- Drop all triggers on pod_assumptions
DROP TRIGGER IF EXISTS trigger_award_assumption_points ON pod_assumptions;
DROP TRIGGER IF EXISTS trigger_award_reference_points_assumptions ON pod_assumptions;
DROP TRIGGER IF EXISTS trigger_notify_new_assumption ON pod_assumptions;

-- Recreate triggers immediately
CREATE TRIGGER trigger_award_assumption_points
  AFTER INSERT ON pod_assumptions
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_assumption();

CREATE TRIGGER trigger_award_reference_points_assumptions
  AFTER INSERT OR UPDATE OF reference_url ON pod_assumptions
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_reference();

CREATE TRIGGER trigger_notify_new_assumption
  AFTER INSERT ON pod_assumptions
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_assumption();

-- Send reload signals
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
