/*
  # Add reference_url to assumption_challenges

  1. Changes
    - `assumption_challenges`: adds optional `reference_url` text column so users can attach a source link when challenging an assumption
*/

ALTER TABLE assumption_challenges ADD COLUMN IF NOT EXISTS reference_url text;
