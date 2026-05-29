/*
  # Add UPDATE policy for entity_challenges

  1. Security
    - Allow users to update their own challenges
*/

CREATE POLICY "Users can update own challenges"
  ON entity_challenges FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
