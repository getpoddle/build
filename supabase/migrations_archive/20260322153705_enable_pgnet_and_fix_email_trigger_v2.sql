/*
  # Enable pg_net Extension and Fix Email Trigger

  1. Changes
    - Enable pg_net extension for making HTTP requests from database
    - Fix the email notification trigger to properly call the edge function
    - Update trigger to pass correct parameters
    
  2. Notes
    - pg_net allows PostgreSQL to make async HTTP requests
    - This is used to call the edge function when a mention notification is created
*/

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Drop the old trigger first
DROP TRIGGER IF EXISTS trigger_send_mention_email ON notifications;

-- Drop the old function
DROP FUNCTION IF EXISTS send_mention_email_notification() CASCADE;

-- Create improved function to send mention email via edge function
CREATE OR REPLACE FUNCTION send_mention_email_notification()
RETURNS TRIGGER AS $$
DECLARE
  mentioned_user_profile record;
  mentioner_profile record;
  edge_function_url text;
  supabase_url text;
  supabase_anon_key text;
  request_id bigint;
BEGIN
  -- Only process mention type notifications
  IF NEW.type != 'mention' THEN
    RETURN NEW;
  END IF;

  -- Get the mentioned user's email preferences
  SELECT email_notifications_enabled INTO mentioned_user_profile
  FROM profiles
  WHERE id = NEW.user_id;

  -- Skip if user has email notifications disabled or email notifications not enabled
  IF mentioned_user_profile IS NULL OR NOT COALESCE(mentioned_user_profile.email_notifications_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Get mentioner's name for the email
  SELECT full_name INTO mentioner_profile
  FROM profiles
  WHERE id = NEW.actor_id;

  -- Get Supabase URL from environment
  supabase_url := current_setting('app.settings', true)::json->>'supabase_url';
  
  -- If not set via app settings, construct from current database
  IF supabase_url IS NULL THEN
    supabase_url := 'https://' || current_setting('app.settings', true)::json->>'project_ref' || '.supabase.co';
  END IF;

  -- Construct the edge function URL
  edge_function_url := supabase_url || '/functions/v1/send-mention-email';

  -- Get anon key (you'll need to set this in your database)
  supabase_anon_key := current_setting('app.settings', true)::json->>'supabase_anon_key';

  -- Make async HTTP request to edge function using pg_net
  SELECT extensions.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(supabase_anon_key, '')
    ),
    body := jsonb_build_object(
      'notificationId', NEW.id::text,
      'mentionedUserId', NEW.user_id::text,
      'mentionerName', COALESCE(mentioner_profile.full_name, 'Someone'),
      'mentionType', COALESCE(NEW.related_type, 'mention'),
      'relatedId', COALESCE(NEW.related_id::text, '')
    )
  ) INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send mention email notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions;

-- Recreate trigger to send email on mention notification
CREATE TRIGGER trigger_send_mention_email
  AFTER INSERT ON notifications
  FOR EACH ROW
  WHEN (NEW.type = 'mention')
  EXECUTE FUNCTION send_mention_email_notification();
