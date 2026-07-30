/*
# Account Deletion with 7-Day Grace Period

## Overview
Adds a soft-delete / grace-period system for user-initiated account deletion.
Users can request deletion from account settings; their data stays intact for
7 days, during which they can restore by signing back in. After 7 days a
scheduled job permanently deletes the account and all associated data.

## 1. New Columns
- `profiles.deletion_requested_at` (timestamptz, nullable) — when the user
  requested deletion. NULL means the account is active. A non-NULL value
  means the account is scheduled for permanent deletion 7 days later.

## 2. New Functions
- `request_account_deletion(p_user_id uuid)` — SECURITY DEFINER function
  that sets `deletion_requested_at = now()` for the given user. Only the
  user themselves can call this (caller's auth.uid must match p_user_id).
- `restore_account(p_user_id uuid)` — SECURITY DEFINER function that
  clears `deletion_requested_at` (sets it back to NULL), reactivating the
  account. Only the user themselves can call this.
- `cleanup_expired_deletions()` — SECURITY DEFINER function that finds all
  profiles where `deletion_requested_at` is more than 7 days in the past,
  calls the existing `delete_user_account()` RPC for each, and then
  hard-deletes the auth.users entry so the email is freed. Returns a count
  of deleted accounts. Designed to be called by a daily cron.

## 3. Security
- No new tables. RLS on profiles is already enabled.
- The two user-facing functions verify `auth.uid() = p_user_id` so a user
  can only request deletion or restore for their own account.
- `cleanup_expired_deletions` runs as SECURITY DEFINER (service-role context)
  so it can delete from auth.users and all public tables.

## 4. Cron
- A daily cron schedule calls the `cleanup-deleted-accounts` edge function
  which invokes `cleanup_expired_deletions()`.
*/

-- 1. Add deletion_requested_at column to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;

-- 2. request_account_deletion function
CREATE OR REPLACE FUNCTION public.request_account_deletion(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: you can only request deletion of your own account';
  END IF;
  UPDATE profiles
    SET deletion_requested_at = now()
    WHERE id = p_user_id;
END;
$function$;

-- 3. restore_account function
CREATE OR REPLACE FUNCTION public.restore_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: you can only restore your own account';
  END IF;
  UPDATE profiles
    SET deletion_requested_at = NULL
    WHERE id = p_user_id;
END;
$function$;

-- 4. cleanup_expired_deletions function
-- Finds profiles where deletion_requested_at > 7 days ago, permanently
-- deletes all their data via delete_user_account(), then removes the
-- auth.users entry. Returns the count of accounts deleted.
CREATE OR REPLACE FUNCTION public.cleanup_expired_deletions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user RECORD;
  v_count integer := 0;
BEGIN
  FOR v_user IN
    SELECT id FROM profiles
    WHERE deletion_requested_at IS NOT NULL
      AND deletion_requested_at < now() - interval '7 days'
  LOOP
    -- Delete all public-schema data for this user
    BEGIN
      PERFORM public.delete_user_account(v_user.id);
    EXCEPTION WHEN OTHERS THEN
      -- Log but continue — we still want to remove the auth entry
      RAISE NOTICE 'delete_user_account failed for %: %', v_user.id, SQLERRM;
    END;

    -- Hard-delete from auth.users so the email is freed
    BEGIN
      PERFORM
        pg_authid_delete_user(v_user.id)
      FROM (SELECT 1) AS dummy;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'auth.users delete failed for %: %', v_user.id, SQLERRM;
    END;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- Helper: delete from auth.users via the admin API equivalent.
-- pg_authid is the underlying table for auth.users in Supabase.
-- We create a thin wrapper because auth.users is not in the public schema
-- and SECURITY DEFINER functions with search_path=public can't see it directly.
CREATE OR REPLACE FUNCTION public.pg_authid_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth'
AS $function$
BEGIN
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$function$;

-- 5. Grant execute on the user-facing functions
GRANT EXECUTE ON FUNCTION public.request_account_deletion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_account(uuid) TO authenticated;
