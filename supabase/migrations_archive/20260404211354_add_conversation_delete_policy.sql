/*
  # Add DELETE policy for conversations

  ## Summary
  Allows users to delete conversations they are a participant in.

  ## Changes
  - Adds a DELETE RLS policy on the `conversations` table
  - Users can only delete conversations where they are `user_one_id` or `user_two_id`
  - Deleting a conversation cascades to delete all messages in it (already handled by FK ON DELETE CASCADE)
*/

CREATE POLICY "Users can delete their own conversations"
  ON conversations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_one_id OR auth.uid() = user_two_id);
