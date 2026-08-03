/*
  # Add Admin Referral Stats and Content Deletion Functions

  1. New Functions
    - `get_user_referral_stats` - Get referral statistics for a user
    - `admin_delete_assumption` - Delete an assumption and its related content
    - `admin_delete_challenge` - Delete a challenge and responses
    - `admin_delete_forecast` - Delete a forecast
    - `admin_delete_risk` - Delete a risk
    - `admin_delete_scenario` - Delete a scenario
    - `admin_delete_challenge_response` - Delete a challenge response

  2. Purpose
    - Allow admins to view referral statistics for each user
    - Allow admins to delete individual content items for moderation
    - Track how many users each user has referred to the platform

  3. Security
    - Functions are only callable by authenticated users (admin check in frontend)
    - All deletes cascade properly to maintain data integrity
*/

-- Function to get user referral stats
CREATE OR REPLACE FUNCTION get_user_referral_stats(user_id_param uuid)
RETURNS TABLE (
  referral_code text,
  total_referrals bigint,
  recent_referrals bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rc.code as referral_code,
    COUNT(rs.id) as total_referrals,
    COUNT(rs.id) FILTER (WHERE rs.created_at > now() - interval '30 days') as recent_referrals
  FROM referral_codes rc
  LEFT JOIN referral_signups rs ON rs.referrer_id = rc.user_id
  WHERE rc.user_id = user_id_param
  GROUP BY rc.code;
END;
$$;

-- Function to delete assumption (admin)
CREATE OR REPLACE FUNCTION admin_delete_assumption(assumption_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete the assumption (cascades to forecasts, risks, scenarios)
  DELETE FROM pod_assumptions WHERE id = assumption_id_param;
END;
$$;

-- Function to delete challenge (admin)
CREATE OR REPLACE FUNCTION admin_delete_challenge(challenge_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete the challenge (cascades to responses)
  DELETE FROM challenges WHERE id = challenge_id_param;
END;
$$;

-- Function to delete forecast (admin)
CREATE OR REPLACE FUNCTION admin_delete_forecast(forecast_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM assumption_forecasts WHERE id = forecast_id_param;
END;
$$;

-- Function to delete risk (admin)
CREATE OR REPLACE FUNCTION admin_delete_risk(risk_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM assumption_risks WHERE id = risk_id_param;
END;
$$;

-- Function to delete scenario (admin)
CREATE OR REPLACE FUNCTION admin_delete_scenario(scenario_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM assumption_scenarios WHERE id = scenario_id_param;
END;
$$;

-- Function to delete challenge response (admin)
CREATE OR REPLACE FUNCTION admin_delete_challenge_response(response_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM challenge_responses WHERE id = response_id_param;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_referral_stats TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_assumption TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_forecast TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_risk TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_scenario TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_challenge_response TO authenticated;