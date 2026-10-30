DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-digest-saturday') THEN
    PERFORM cron.unschedule('weekly-digest-saturday');
  END IF;
END $$;