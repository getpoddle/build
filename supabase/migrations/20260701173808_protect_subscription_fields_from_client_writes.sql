
-- Trigger function for profiles: block client-side writes to subscription_tier.
-- Only service_role (used by stripe-webhook) or internal DB calls (NULL jwt) may change it.
CREATE OR REPLACE FUNCTION protect_subscription_fields_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  BEGIN
    jwt_role := (current_setting('request.jwt.claims', true)::json) ->> 'role';
  EXCEPTION WHEN OTHERS THEN
    jwt_role := NULL;
  END;

  IF jwt_role IS NOT NULL AND jwt_role <> 'service_role' THEN
    NEW.subscription_tier := OLD.subscription_tier;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger function for workspaces: block client-side writes to all subscription/billing fields.
CREATE OR REPLACE FUNCTION protect_subscription_fields_workspaces()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  BEGIN
    jwt_role := (current_setting('request.jwt.claims', true)::json) ->> 'role';
  EXCEPTION WHEN OTHERS THEN
    jwt_role := NULL;
  END;

  IF jwt_role IS NOT NULL AND jwt_role <> 'service_role' THEN
    NEW.plan                   := OLD.plan;
    NEW.subscription_status    := OLD.subscription_status;
    NEW.seats                  := OLD.seats;
    NEW.stripe_customer_id     := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
    NEW.current_period_end     := OLD.current_period_end;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_subscription_fields_profiles_trigger ON profiles;
CREATE TRIGGER protect_subscription_fields_profiles_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_subscription_fields_profiles();

DROP TRIGGER IF EXISTS protect_subscription_fields_workspaces_trigger ON workspaces;
CREATE TRIGGER protect_subscription_fields_workspaces_trigger
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION protect_subscription_fields_workspaces();
