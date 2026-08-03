/*
  # Fix Function Search Paths

  1. Security Improvements
    - Set explicit search_path for all functions to prevent search_path attacks
    - Ensures functions always reference the correct schema
  
  2. Functions Fixed (12 total)
    - update_pod_forecast_stats
    - update_assumption_challenge_count
    - award_referral_points
    - update_decision_thread_timestamp
    - update_decision_dissent_count
    - notify_assumption_mention
    - notify_challenge_mention
    - notify_forecast_comment
    - notify_risk_comment
    - notify_scenario_comment
    - notify_assumption_comment
    - update_profiles_search_vector
*/

-- update_pod_forecast_stats
ALTER FUNCTION public.update_pod_forecast_stats() SET search_path = public, pg_temp;

-- update_assumption_challenge_count
ALTER FUNCTION public.update_assumption_challenge_count() SET search_path = public, pg_temp;

-- award_referral_points
ALTER FUNCTION public.award_referral_points() SET search_path = public, pg_temp;

-- update_decision_thread_timestamp
ALTER FUNCTION public.update_decision_thread_timestamp() SET search_path = public, pg_temp;

-- update_decision_dissent_count
ALTER FUNCTION public.update_decision_dissent_count() SET search_path = public, pg_temp;

-- notify_assumption_mention
ALTER FUNCTION public.notify_assumption_mention() SET search_path = public, pg_temp;

-- notify_challenge_mention
ALTER FUNCTION public.notify_challenge_mention() SET search_path = public, pg_temp;

-- notify_forecast_comment
ALTER FUNCTION public.notify_forecast_comment() SET search_path = public, pg_temp;

-- notify_risk_comment
ALTER FUNCTION public.notify_risk_comment() SET search_path = public, pg_temp;

-- notify_scenario_comment
ALTER FUNCTION public.notify_scenario_comment() SET search_path = public, pg_temp;

-- notify_assumption_comment
ALTER FUNCTION public.notify_assumption_comment() SET search_path = public, pg_temp;

-- update_profiles_search_vector
ALTER FUNCTION public.update_profiles_search_vector() SET search_path = public, pg_temp;
