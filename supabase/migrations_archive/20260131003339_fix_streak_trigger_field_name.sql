/*
  # Fix streak trigger to use correct field name

  1. Changes
    - Update update_user_streak function to use `last_participation_date` instead of `last_completion_date`
    - The actual column in user_challenge_streaks table is `last_participation_date`
    - This fixes the error: "streak_record has no field last_completion_date"
*/

CREATE OR REPLACE FUNCTION update_user_streak()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  streak_record RECORD;
  last_date DATE;
BEGIN
  SELECT * INTO streak_record
  FROM user_challenge_streaks
  WHERE user_id = NEW.user_id
  FOR UPDATE;

  IF streak_record IS NULL THEN
    INSERT INTO user_challenge_streaks (user_id, current_streak, longest_streak, last_participation_date)
    VALUES (NEW.user_id, 1, 1, CURRENT_DATE);
  ELSE
    last_date := streak_record.last_participation_date;
    
    IF CURRENT_DATE = last_date THEN
      RETURN NEW;
    ELSIF CURRENT_DATE = last_date + INTERVAL '1 day' THEN
      UPDATE user_challenge_streaks
      SET 
        current_streak = current_streak + 1,
        longest_streak = GREATEST(longest_streak, current_streak + 1),
        last_participation_date = CURRENT_DATE
      WHERE user_id = NEW.user_id;
    ELSE
      UPDATE user_challenge_streaks
      SET 
        current_streak = 1,
        last_participation_date = CURRENT_DATE
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
