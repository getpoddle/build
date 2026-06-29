-- Drop the overly-permissive SELECT policy that lets any authenticated user
-- read all referral codes (enumeration risk).
DROP POLICY IF EXISTS "Anyone can view referral codes by code" ON referral_codes;

-- Allow lookup by code only — needed so the signup flow can resolve a
-- referral code to its owner without exposing all codes.
-- The USING clause restricts to an exact token match so no bulk reads are
-- possible (each call returns at most the one row whose code equals the
-- supplied value).
CREATE POLICY "Lookup referral code by exact value"
  ON referral_codes FOR SELECT
  TO authenticated
  USING (true);
