/*
  # Fix Verification Eligibility Function Column Names

  1. Changes
    - Update function to use correct column names:
      - `location` instead of `city`
      - `author_id` instead of `user_id` in posts and comments tables
    
  2. Purpose
    - Fixes the verification eligibility check to work with actual table schema
*/

CREATE OR REPLACE FUNCTION check_verification_eligibility(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_data RECORD;
  activity_count INTEGER;
  account_age_days INTEGER;
  result jsonb;
BEGIN
  SELECT 
    p.id,
    p.first_name,
    p.last_name,
    p.location,
    p.country,
    p.verified,
    p.verification_requested_at,
    p.created_at,
    au.email_confirmed_at
  INTO profile_data
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE p.id = user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'already_verified', false,
      'verification_pending', false,
      'reason', 'Profile not found'
    );
  END IF;

  SELECT COUNT(*)
  INTO activity_count
  FROM (
    SELECT id FROM posts WHERE author_id = user_id
    UNION ALL
    SELECT id FROM comments WHERE author_id = user_id
  ) activities;

  account_age_days := EXTRACT(DAY FROM (NOW() - profile_data.created_at));

  result := jsonb_build_object(
    'eligible', 
      profile_data.email_confirmed_at IS NOT NULL AND
      profile_data.first_name IS NOT NULL AND 
      profile_data.first_name != '' AND
      profile_data.last_name IS NOT NULL AND
      profile_data.last_name != '' AND
      (profile_data.location IS NOT NULL OR profile_data.country IS NOT NULL) AND
      account_age_days >= 7 AND
      activity_count >= 3 AND
      NOT profile_data.verified AND
      profile_data.verification_requested_at IS NULL,
    'criteria', jsonb_build_object(
      'email_confirmed', profile_data.email_confirmed_at IS NOT NULL,
      'has_full_name', 
        profile_data.first_name IS NOT NULL AND 
        profile_data.first_name != '' AND
        profile_data.last_name IS NOT NULL AND
        profile_data.last_name != '',
      'has_location', profile_data.location IS NOT NULL OR profile_data.country IS NOT NULL,
      'account_age_days', account_age_days,
      'min_age_met', account_age_days >= 7,
      'activity_count', activity_count,
      'min_activity_met', activity_count >= 3
    ),
    'already_verified', profile_data.verified,
    'verification_pending', profile_data.verification_requested_at IS NOT NULL AND NOT profile_data.verified
  );

  RETURN result;
END;
$$;