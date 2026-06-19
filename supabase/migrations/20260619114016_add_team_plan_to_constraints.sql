-- Add 'team' as a valid value for workspaces.plan and profiles.subscription_tier

-- workspaces.plan
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_check;
ALTER TABLE workspaces ADD CONSTRAINT workspaces_plan_check
  CHECK (plan = ANY (ARRAY['pro'::text, 'team'::text, 'enterprise'::text]));

-- profiles.subscription_tier
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier = ANY (ARRAY['free'::text, 'pro'::text, 'team'::text, 'enterprise'::text]));
