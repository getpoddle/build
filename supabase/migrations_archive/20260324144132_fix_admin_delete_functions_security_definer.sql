/*
  # Fix all admin_delete functions to use SECURITY DEFINER

  ## Problem
  The admin_delete_* functions were missing SECURITY DEFINER, meaning they ran
  as the calling user (the admin). Since RLS DELETE policies check `created_by = auth.uid()`,
  admins could not delete content owned by other users.

  ## Fix
  Recreate all admin_delete_* functions with:
  - SECURITY DEFINER so they bypass RLS and run as the function owner
  - is_admin() check to ensure only admins can call them
  - SET search_path = public for security
*/

CREATE OR REPLACE FUNCTION admin_delete_assumption(assumption_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM pod_assumptions WHERE id = assumption_id_param;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_challenge(challenge_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM assumption_challenges WHERE id = challenge_id_param;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_forecast(forecast_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM assumption_forecasts WHERE id = forecast_id_param;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_risk(risk_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM assumption_risks WHERE id = risk_id_param;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_scenario(scenario_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM assumption_scenarios WHERE id = scenario_id_param;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_challenge_response(response_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM challenge_responses WHERE id = response_id_param;
END;
$$;
