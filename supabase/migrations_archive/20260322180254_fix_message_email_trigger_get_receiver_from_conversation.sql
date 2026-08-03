/*
  # Fix Message Email Trigger - Get Receiver from Conversation
  
  ## Overview
  The trigger_message_email function was trying to access NEW.receiver_id which doesn't exist.
  Messages have conversation_id instead, so we need to get the receiver from the conversation.
  
  ## Changes
  - Update trigger_message_email to get receiver_id from conversations table
*/

CREATE OR REPLACE FUNCTION trigger_message_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  recipient_email text;
  recipient_name text;
  sender_name text;
  recipient_email_enabled boolean;
  receiver_id uuid;
BEGIN
  -- Get the receiver_id from the conversation
  -- The receiver is the user who is NOT the sender
  SELECT 
    CASE 
      WHEN user_one_id = NEW.sender_id THEN user_two_id
      ELSE user_one_id
    END INTO receiver_id
  FROM conversations
  WHERE id = NEW.conversation_id;
  
  -- Get recipient info
  SELECT p.email, p.full_name, p.email_notifications_enabled
  INTO recipient_email, recipient_name, recipient_email_enabled
  FROM profiles p
  WHERE p.id = receiver_id;
  
  -- Get sender name
  SELECT p.full_name INTO sender_name
  FROM profiles p
  WHERE p.id = NEW.sender_id;
  
  -- Only send email if recipient has email notifications enabled
  IF recipient_email_enabled THEN
    INSERT INTO email_notification_queue (
      user_id,
      email,
      subject,
      body,
      notification_type
    )
    VALUES (
      receiver_id,
      recipient_email,
      'New message from ' || sender_name,
      'You have received a new message from ' || sender_name || ': ' || 
      SUBSTRING(NEW.content, 1, 100) || 
      CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END,
      'message'
    );
  END IF;
  
  RETURN NEW;
END;
$$;
