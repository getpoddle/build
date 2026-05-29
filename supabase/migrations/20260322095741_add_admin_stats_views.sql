/*
  # Add Admin Statistics Views

  1. New Functions
    - `get_user_contribution_stats` - Get comprehensive user contribution statistics
    
  2. Purpose
    - Provide admins with detailed user statistics
    - Show contributions across all content types
    - Performance optimized with proper indexing
*/

-- Function to get user contribution statistics
CREATE OR REPLACE FUNCTION public.get_user_contribution_stats(user_id_param uuid)
RETURNS TABLE(
  assumptions_count bigint,
  challenges_count bigint,
  forecasts_count bigint,
  risks_count bigint,
  scenarios_count bigint,
  challenge_responses_count bigint,
  pods_joined_count bigint,
  insight_score bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM pod_assumptions WHERE created_by = user_id_param)::bigint,
    (SELECT COUNT(*) FROM challenges WHERE creator_id = user_id_param)::bigint,
    (SELECT COUNT(*) FROM assumption_forecasts WHERE user_id = user_id_param)::bigint,
    (SELECT COUNT(*) FROM assumption_risks WHERE created_by = user_id_param)::bigint,
    (SELECT COUNT(*) FROM assumption_scenarios WHERE created_by = user_id_param)::bigint,
    (SELECT COUNT(*) FROM challenge_responses WHERE user_id = user_id_param)::bigint,
    (SELECT COUNT(*) FROM pod_members WHERE user_id = user_id_param)::bigint,
    COALESCE((SELECT p.insight_score FROM profiles p WHERE p.id = user_id_param), 0)::bigint;
END;
$$;