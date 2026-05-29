/*
  # Fix notify_comment_mention title/content swap

  The notify_comment_mention function had title and content values reversed:
  - title was set to: "X mentioned you in a comment" (should be content)
  - content was set to: "You were mentioned in a comment" (should be title)

  This fix aligns it with the correct pattern used by all other mention functions.
*/

CREATE OR REPLACE FUNCTION notify_comment_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mentioner_name text;
BEGIN
  SELECT full_name INTO mentioner_name
  FROM profiles
  WHERE id = NEW.mentioned_by_user_id;

  INSERT INTO notifications (
    user_id,
    type,
    title,
    content,
    related_id,
    related_type,
    actor_id,
    created_at
  )
  VALUES (
    NEW.mentioned_user_id,
    'mention',
    'You were mentioned',
    COALESCE(mentioner_name, 'Someone') || ' mentioned you in a comment',
    NEW.comment_id,
    'comment',
    NEW.mentioned_by_user_id,
    now()
  );

  RETURN NEW;
END;
$$;
