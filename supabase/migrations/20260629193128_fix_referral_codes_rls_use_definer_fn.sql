-- Drop the broad SELECT policy that allowed any authenticated user to read
-- all referral codes (enumeration risk).
DROP POLICY IF EXISTS "Lookup referral code by exact value" ON referral_codes;
DROP POLICY IF EXISTS "Anyone can view referral codes by code" ON referral_codes;

-- Create a SECURITY DEFINER function that resolves a referral code to its
-- owner without exposing the full referral_codes table to direct client reads.
CREATE OR REPLACE FUNCTION lookup_referral_code(p_code text)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM referral_codes WHERE code = p_code LIMIT 1;
$$;

-- Only authenticated users may call the function.
REVOKE ALL ON FUNCTION lookup_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_referral_code(text) TO authenticated;
