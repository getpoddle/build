
CREATE OR REPLACE FUNCTION public.increment_daily_ai_usage(p_user_id uuid, p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO daily_ai_usage (user_id, date, message_count)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET message_count = daily_ai_usage.message_count + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_daily_ai_usage(uuid, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.increment_daily_ai_usage(uuid, date) TO authenticated, service_role;
