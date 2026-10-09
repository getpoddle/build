/*
# Enterprise Security: Revoke EXECUTE from PUBLIC on ALL SECURITY DEFINER Functions

## Summary
The previous migration revoked EXECUTE from the `anon` role on all SECURITY
DEFINER functions. However, Supabase auto-grants EXECUTE to `PUBLIC` when
functions are created, and `anon` inherits from `PUBLIC`. This means the
`REVOKE ... FROM anon` only removed the explicit `anon=X` grant but not the
inherited `=X` (PUBLIC) grant.

This migration revokes EXECUTE from `PUBLIC` on all SECURITY DEFINER functions,
then re-grants EXECUTE to `authenticated` only on the functions the frontend
legitimately calls via supabase.rpc().

## Approach
1. REVOKE EXECUTE FROM PUBLIC on all SECURITY DEFINER functions (DO block)
2. GRANT EXECUTE TO authenticated on the 40+ functions the frontend calls

## Functions re-granted to authenticated
All functions called via supabase.rpc() in the frontend source code:
approve_verification, reject_verification, ban_user_account, suspend_user_account,
unsuspend_user_account, get_admin_all_users, get_admin_all_workspaces,
get_admin_user_workspaces, get_profiles_sensitive_admin, get_training_dataset_stats,
get_own_profile_sensitive, check_username_available, suggest_usernames,
lookup_referral_code, increment_blog_view_count, increment_assumption_view,
increment_assumption_share, increment_post_share, get_benchmark_percentile,
get_decision_benchmark_stats, get_my_training_contribution_count,
get_organization_invite_by_token, accept_organization_invite,
get_organization_portfolio_health, get_organization_decision_overview,
update_organization_member_role, remove_organization_member, create_organization,
get_invite_by_token, set_workspace_organization, can_verify_evidence,
create_decision_snapshot, is_decision_owner, is_evidence_reviewer,
is_workspace_admin_or_owner, request_reverification, reverify_decision_claim,
revise_evidence_claim, update_evidence_classification, get_workspace_role,
get_organization_role, get_workspace_war_room_usage, restore_account
*/

-- ============================================================
-- PART 1: Revoke EXECUTE from PUBLIC on ALL SECURITY DEFINER functions
-- ============================================================

DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I(%s) FROM PUBLIC', f.proname, f.args);
  END LOOP;
END $$;

-- ============================================================
-- PART 2: Re-grant EXECUTE to authenticated on frontend-called functions
-- ============================================================

GRANT EXECUTE ON FUNCTION approve_verification TO authenticated;
GRANT EXECUTE ON FUNCTION reject_verification TO authenticated;
GRANT EXECUTE ON FUNCTION ban_user_account TO authenticated;
GRANT EXECUTE ON FUNCTION suspend_user_account TO authenticated;
GRANT EXECUTE ON FUNCTION unsuspend_user_account TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_all_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_all_workspaces TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_user_workspaces TO authenticated;
GRANT EXECUTE ON FUNCTION get_profiles_sensitive_admin TO authenticated;
GRANT EXECUTE ON FUNCTION get_training_dataset_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_own_profile_sensitive TO authenticated;
GRANT EXECUTE ON FUNCTION check_username_available TO authenticated;
GRANT EXECUTE ON FUNCTION suggest_usernames TO authenticated;
GRANT EXECUTE ON FUNCTION lookup_referral_code TO authenticated;
GRANT EXECUTE ON FUNCTION increment_blog_view_count TO authenticated;
GRANT EXECUTE ON FUNCTION increment_assumption_view TO authenticated;
GRANT EXECUTE ON FUNCTION increment_assumption_share TO authenticated;
GRANT EXECUTE ON FUNCTION increment_post_share TO authenticated;
GRANT EXECUTE ON FUNCTION get_benchmark_percentile TO authenticated;
GRANT EXECUTE ON FUNCTION get_decision_benchmark_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_training_contribution_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_organization_invite_by_token TO authenticated;
GRANT EXECUTE ON FUNCTION accept_organization_invite TO authenticated;
GRANT EXECUTE ON FUNCTION get_organization_portfolio_health TO authenticated;
GRANT EXECUTE ON FUNCTION get_organization_decision_overview TO authenticated;
GRANT EXECUTE ON FUNCTION update_organization_member_role TO authenticated;
GRANT EXECUTE ON FUNCTION remove_organization_member TO authenticated;
GRANT EXECUTE ON FUNCTION create_organization TO authenticated;
GRANT EXECUTE ON FUNCTION get_invite_by_token TO authenticated;
GRANT EXECUTE ON FUNCTION set_workspace_organization TO authenticated;
GRANT EXECUTE ON FUNCTION can_verify_evidence TO authenticated;
GRANT EXECUTE ON FUNCTION create_decision_snapshot TO authenticated;
GRANT EXECUTE ON FUNCTION is_decision_owner TO authenticated;
GRANT EXECUTE ON FUNCTION is_evidence_reviewer TO authenticated;
GRANT EXECUTE ON FUNCTION is_workspace_admin_or_owner TO authenticated;
GRANT EXECUTE ON FUNCTION request_reverification TO authenticated;
GRANT EXECUTE ON FUNCTION reverify_decision_claim TO authenticated;
GRANT EXECUTE ON FUNCTION revise_evidence_claim TO authenticated;
GRANT EXECUTE ON FUNCTION update_evidence_classification TO authenticated;
GRANT EXECUTE ON FUNCTION get_workspace_role TO authenticated;
GRANT EXECUTE ON FUNCTION get_organization_role TO authenticated;
GRANT EXECUTE ON FUNCTION get_workspace_war_room_usage TO authenticated;
GRANT EXECUTE ON FUNCTION restore_account TO authenticated;
