/*
  # Fix Referral Codes Duplicate Entries

  ## Summary
  Two users have duplicate rows in referral_codes causing maybeSingle() to throw.
  Deduplicates by keeping the earliest-created row per user, then adds a unique
  constraint on user_id to prevent future duplicates.
*/

DELETE FROM referral_codes
WHERE id IN (
  'df66423f-6408-41a5-8966-c9c904723837',
  '22cd7872-1d9a-4881-92b7-289467f9d151'
);

ALTER TABLE referral_codes
  DROP CONSTRAINT IF EXISTS referral_codes_user_id_unique;

ALTER TABLE referral_codes
  ADD CONSTRAINT referral_codes_user_id_unique UNIQUE (user_id);
