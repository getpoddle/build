/*
  # Add Comment Count Trigger

  This migration creates a trigger system to automatically update the comment_count field on insights
  whenever comments are added or deleted.

  ## Changes

  1. **Functions**
    - `update_insight_comment_count()` - Updates the comment_count on insights table
    - `sync_all_comment_counts()` - One-time sync to fix any existing data discrepancies

  2. **Triggers**
    - Automatically increment comment_count when a comment is added
    - Automatically decrement comment_count when a comment is deleted

  3. **Data Fix**
    - Sync all existing comment counts to ensure data accuracy

  ## Important Notes

  - This ensures comment counts are always accurate and up-to-date
  - Prevents discrepancies between actual comments and displayed counts
  - Critical for user engagement as incorrect counts can discourage participation
*/

-- Function to update comment count on insights
CREATE OR REPLACE FUNCTION update_insight_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE insights
    SET comment_count = comment_count + 1
    WHERE id = NEW.insight_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE insights
    SET comment_count = GREATEST(0, comment_count - 1)
    WHERE id = OLD.insight_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for comment insertions
DROP TRIGGER IF EXISTS trigger_increment_comment_count ON comments;
CREATE TRIGGER trigger_increment_comment_count
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_insight_comment_count();

-- Create trigger for comment deletions
DROP TRIGGER IF EXISTS trigger_decrement_comment_count ON comments;
CREATE TRIGGER trigger_decrement_comment_count
  AFTER DELETE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_insight_comment_count();

-- Function to sync all comment counts (one-time fix for existing data)
CREATE OR REPLACE FUNCTION sync_all_comment_counts()
RETURNS void AS $$
BEGIN
  UPDATE insights
  SET comment_count = (
    SELECT COUNT(*)
    FROM comments
    WHERE comments.insight_id = insights.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the sync to fix any existing discrepancies
SELECT sync_all_comment_counts();