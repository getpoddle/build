/*
  # Disable Message Email Trigger Temporarily
  
  ## Overview
  The email notification system needs a complete overhaul. For now, disable email notifications
  for messages so that message sending works properly.
  
  ## Changes
  - Make trigger_message_email a no-op function
*/

CREATE OR REPLACE FUNCTION trigger_message_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Email notifications disabled temporarily
  -- TODO: Implement proper email notification system
  RETURN NEW;
END;
$$;
