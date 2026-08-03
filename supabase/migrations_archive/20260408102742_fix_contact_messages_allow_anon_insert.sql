/*
  # Fix contact_messages INSERT policy to allow unauthenticated users

  ## Problem
  The existing INSERT policy uses `TO authenticated` which means logged-out users
  cannot submit the contact form. The contact form on the public-facing ContactUs
  page must work for everyone.

  ## Changes
  - Drop the existing authenticated-only INSERT policy
  - Create a new INSERT policy that allows both authenticated and anonymous users
    (anon role) to insert contact messages, with no WITH CHECK restriction beyond
    what the edge function enforces
*/

DROP POLICY IF EXISTS "Anyone can insert a contact message" ON contact_messages;

CREATE POLICY "Anyone can submit a contact message"
  ON contact_messages
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);
