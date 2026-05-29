/*
  # Fix Mutable Search Path on Functions

  ## Summary
  Adds SET search_path = 'public', 'pg_temp' to all functions that had a mutable
  search_path, preventing potential search_path injection attacks.

  ## Functions fixed
  - update_pod_forecast_stats
  - update_assumption_challenge_count
  - check_and_award_achievements (scalar version)
  - update_profiles_search_vector
*/

CREATE OR REPLACE FUNCTION public.update_pod_forecast_stats()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_pod_id uuid;
  v_count integer;
  v_avg numeric;
  v_stddev numeric;
  v_disagreement integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_pod_id := OLD.pod_id;
  ELSE
    v_pod_id := NEW.pod_id;
  END IF;

  SELECT
    COUNT(*),
    COALESCE(AVG(probability), 0),
    COALESCE(STDDEV(probability), 0)
  INTO v_count, v_avg, v_stddev
  FROM pod_forecasts
  WHERE pod_id = v_pod_id;

  v_disagreement := LEAST(100, ROUND((v_stddev / 50.0) * 100));

  UPDATE pods SET
    forecast_count = v_count,
    avg_probability = v_avg,
    disagreement_level = v_disagreement
  WHERE id = v_pod_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_assumption_challenge_count()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_assumption_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_assumption_id := OLD.assumption_id;
  ELSE
    v_assumption_id := NEW.assumption_id;
  END IF;

  UPDATE pod_assumptions SET
    challenge_count = (SELECT COUNT(*) FROM assumption_challenges WHERE assumption_id = v_assumption_id)
  WHERE id = v_assumption_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_and_award_achievements(p_user_id uuid, p_stat_type text, p_stat_value integer)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  achievement_record RECORD;
  newly_awarded boolean;
BEGIN
  FOR achievement_record IN
    SELECT id, points FROM achievements
    WHERE requirement_type = p_stat_type
    AND requirement_value <= p_stat_value
  LOOP
    newly_awarded := false;

    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, achievement_record.id)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING id INTO newly_awarded;

    IF newly_awarded THEN
      UPDATE user_stats
      SET total_points = total_points + achievement_record.points,
          level = FLOOR((total_points + achievement_record.points) / 100) + 1
      WHERE user_id = p_user_id;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_profiles_search_vector()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.full_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.bio, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.job_title, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.about_me, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.country, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.location, '')), 'C');
  RETURN NEW;
END;
$$;
