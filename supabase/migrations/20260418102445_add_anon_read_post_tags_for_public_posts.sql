/*
  # Allow anon to read post_tags for public post pages

  ## Changes
  - Adds a SELECT policy on post_tags for anon role
    so unauthenticated visitors can read tags when
    viewing shared public post links.
*/

CREATE POLICY "Anyone can read post tags"
  ON post_tags
  FOR SELECT
  TO anon
  USING (true);
