
-- ============================================================
-- 1. Fix the broken set_inbox_slug trigger on profiles
--    The inbox_slug column was removed but the trigger remains.
--    Drop the trigger — it's the root cause of profile creation
--    failing silently for every new user signup.
-- ============================================================
DROP TRIGGER IF EXISTS set_inbox_slug ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_inbox_slug() CASCADE;

-- ============================================================
-- 2. Backfill: create the missing profile for every auth user
--    that has no profile record (currently 1: getpoddle@gmail.com)
-- ============================================================
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  first_name,
  last_name,
  username,
  onboarded,
  created_at,
  updated_at
)
SELECT
  au.id,
  au.email,
  COALESCE(
    NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''),
    COALESCE(
      NULLIF(TRIM(au.raw_user_meta_data->>'first_name'), '') || ' ' || NULLIF(TRIM(au.raw_user_meta_data->>'last_name'), ''),
      au.email
    )
  ),
  NULLIF(TRIM(au.raw_user_meta_data->>'first_name'), ''),
  NULLIF(TRIM(au.raw_user_meta_data->>'last_name'), ''),
  NULLIF(TRIM(au.raw_user_meta_data->>'username'), ''),
  false,
  au.created_at,
  now()
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
  AND au.email != 'ai-bot@poddle.app'
ON CONFLICT (id) DO NOTHING;

-- Backfill user_account_status for any orphaned users
INSERT INTO public.user_account_status (user_id, status)
SELECT au.id, 'active'
FROM auth.users au
LEFT JOIN public.user_account_status uas ON uas.user_id = au.id
WHERE uas.user_id IS NULL
  AND au.email != 'ai-bot@poddle.app'
ON CONFLICT (user_id) DO NOTHING;

-- Backfill user_stats for any orphaned users
INSERT INTO public.user_stats (user_id)
SELECT au.id
FROM auth.users au
LEFT JOIN public.user_stats us ON us.user_id = au.id
WHERE us.user_id IS NULL
  AND au.email != 'ai-bot@poddle.app'
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- 3. Create the function that auto-creates a profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    first_name,
    last_name,
    username,
    onboarded,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NEW.email
    ),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. Attach trigger to auth.users so every new signup
--    automatically gets a profile row immediately
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
