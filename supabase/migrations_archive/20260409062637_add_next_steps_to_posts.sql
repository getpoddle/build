/*
  # Add next_steps column to posts

  ## Summary
  Adds a `next_steps` column to the posts table to store AI-generated actionable
  next steps for breakthrough idea posts. This powers the "What to do with this idea"
  section in the Ideas Archive, making the content stickier and more valuable.

  ## Changes
  1. `posts.next_steps` (text, nullable) — JSON array serialised as text containing
     3-5 actionable next steps for breakthrough idea posts.
     Format: JSON array of objects: [{ "step": "...", "who": "...", "timeframe": "..." }]
*/

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS next_steps text DEFAULT NULL;
