-- Add 'business' as a valid value for profiles.subscription_tier
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier = ANY (ARRAY['free'::text, 'pro'::text, 'team'::text, 'business'::text, 'enterprise'::text]));
