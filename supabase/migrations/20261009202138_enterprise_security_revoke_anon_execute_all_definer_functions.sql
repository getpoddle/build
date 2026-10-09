/*
# Enterprise Security: Revoke EXECUTE from anon on ALL SECURITY DEFINER Functions

## Summary
Every SECURITY DEFINER function in the public schema had EXECUTE auto-granted to
PUBLIC (inherited by anon). This meant any unauthenticated visitor could call
privileged functions like delete_user_account, ban_user_account,
get_profiles_sensitive_admin, approve_verification, etc. via the REST RPC API.

This migration:
1. Revokes EXECUTE from anon on ALL SECURITY DEFINER functions
2. Also revokes EXECUTE from authenticated on trigger/helper/internal functions
3. Pins search_path on 6 functions missing it (search-path hijack risk)
4. Revokes all CRUD privileges from anon and authenticated on 6 locked tables

## Functions that KEEP EXECUTE on authenticated (called by the frontend)
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

## Locked table privilege revocation
email_confirmation_tokens, password_reset_attempts, processed_stripe_events,
agent_posting_queue, agent_routing_config, workspace_seed_threads
*/

-- ============================================================
-- PART 1: Revoke EXECUTE from anon on ALL SECURITY DEFINER functions
-- Use a DO block to handle all functions programmatically
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
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I(%s) FROM anon', f.proname, f.args);
  END LOOP;
END $$;

-- ============================================================
-- PART 2: Revoke EXECUTE from authenticated on internal/trigger functions
-- These are functions the frontend never calls directly via supabase.rpc()
-- ============================================================

REVOKE EXECUTE ON FUNCTION add_war_room_discussed_item FROM authenticated;
REVOKE EXECUTE ON FUNCTION admin_delete_assumption FROM authenticated;
REVOKE EXECUTE ON FUNCTION admin_delete_challenge FROM authenticated;
REVOKE EXECUTE ON FUNCTION admin_delete_challenge_response FROM authenticated;
REVOKE EXECUTE ON FUNCTION admin_delete_forecast FROM authenticated;
REVOKE EXECUTE ON FUNCTION admin_delete_risk FROM authenticated;
REVOKE EXECUTE ON FUNCTION admin_delete_scenario FROM authenticated;
REVOKE EXECUTE ON FUNCTION award_referral_points FROM authenticated;
REVOKE EXECUTE ON FUNCTION backfill_agent_responses_for_assumption(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION backfill_basic_agent_response(uuid, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION calculate_accuracy_score FROM authenticated;
REVOKE EXECUTE ON FUNCTION check_and_award_achievements() FROM authenticated;
REVOKE EXECUTE ON FUNCTION check_and_award_achievements(uuid, text, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION check_verification_eligibility FROM authenticated;
REVOKE EXECUTE ON FUNCTION cleanup_expired_deletions FROM authenticated;
REVOKE EXECUTE ON FUNCTION cleanup_orphaned_auth_users FROM authenticated;
REVOKE EXECUTE ON FUNCTION consume_war_room_session FROM authenticated;
REVOKE EXECUTE ON FUNCTION create_first_signin_workspace FROM authenticated;
REVOKE EXECUTE ON FUNCTION create_mention_notification FROM authenticated;
REVOKE EXECUTE ON FUNCTION create_organization_invite FROM authenticated;
REVOKE EXECUTE ON FUNCTION create_workspace_invite FROM authenticated;
REVOKE EXECUTE ON FUNCTION delete_user_account FROM authenticated;
REVOKE EXECUTE ON FUNCTION enforce_beta_expiry_on_workspaces FROM authenticated;
REVOKE EXECUTE ON FUNCTION enforce_decision_status_permission FROM authenticated;
REVOKE EXECUTE ON FUNCTION generate_agent_response(uuid, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION generate_comprehensive_agent_response(uuid, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_agent_conversation_history FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_all_users_contribution_stats FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_all_users_moderation_info FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_all_users_referral_stats FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_all_users_workspace_pdf_stats FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_digest_recipients FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_follower_count FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_following_count FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_pending_reports_count FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_supabase_anon_key FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_supabase_url FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_user_contribution_stats FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_user_moderation_info FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_user_referral_stats FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_workspace_usage_stats FROM authenticated;
REVOKE EXECUTE ON FUNCTION handle_email_confirmed FROM authenticated;
REVOKE EXECUTE ON FUNCTION handle_new_assumption FROM authenticated;
REVOKE EXECUTE ON FUNCTION handle_new_assumption_challenge FROM authenticated;
REVOKE EXECUTE ON FUNCTION handle_new_forecast FROM authenticated;
REVOKE EXECUTE ON FUNCTION handle_new_risk FROM authenticated;
REVOKE EXECUTE ON FUNCTION handle_new_scenario FROM authenticated;
REVOKE EXECUTE ON FUNCTION handle_new_user FROM authenticated;
REVOKE EXECUTE ON FUNCTION handle_new_user_account_status FROM authenticated;
REVOKE EXECUTE ON FUNCTION increment_daily_ai_usage FROM authenticated;
REVOKE EXECUTE ON FUNCTION increment_thread_view FROM authenticated;
REVOKE EXECUTE ON FUNCTION is_admin FROM authenticated;
REVOKE EXECUTE ON FUNCTION is_current_user_admin FROM authenticated;
REVOKE EXECUTE ON FUNCTION is_following FROM authenticated;
REVOKE EXECUTE ON FUNCTION is_pod_member FROM authenticated;
REVOKE EXECUTE ON FUNCTION is_room_member FROM authenticated;
REVOKE EXECUTE ON FUNCTION is_room_owner FROM authenticated;
REVOKE EXECUTE ON FUNCTION is_workspace_member FROM authenticated;
REVOKE EXECUTE ON FUNCTION is_workspace_public FROM authenticated;
REVOKE EXECUTE ON FUNCTION log_workspace_creation FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_achievement_unlock FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_admins_on_ai_chat FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_assumption_comment FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_assumption_mention FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_challenge_mention FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_challenge_posted FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_challenge_response FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_challenge_response_mention FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_comment_mention FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_decision_approval_requested FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_follow_email FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_forecast_comment FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_forecasters_on_outcome FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_insight_added FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_insight_comment FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_insight_reaction FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_members_on_team_chat FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_mention_email FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_mentioned_members FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_new_follower FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_organization_invite_accepted FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_risk_comment FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_scenario_comment FROM authenticated;
REVOKE EXECUTE ON FUNCTION pg_authid_delete_user FROM authenticated;
REVOKE EXECUTE ON FUNCTION process_synthesis_queue FROM authenticated;
REVOKE EXECUTE ON FUNCTION protect_subscription_fields_profiles FROM authenticated;
REVOKE EXECUTE ON FUNCTION protect_subscription_fields_workspaces FROM authenticated;
REVOKE EXECUTE ON FUNCTION recompute_calibration_for_forecasters FROM authenticated;
REVOKE EXECUTE ON FUNCTION refresh_training_pair_outcomes FROM authenticated;
REVOKE EXECUTE ON FUNCTION request_account_deletion FROM authenticated;
REVOKE EXECUTE ON FUNCTION sync_all_comment_counts FROM authenticated;
REVOKE EXECUTE ON FUNCTION sync_pattern_intelligence_on_workspace_delete FROM authenticated;
REVOKE EXECUTE ON FUNCTION toggle_challenge_vote FROM authenticated;
REVOKE EXECUTE ON FUNCTION trigger_agent_responses() FROM authenticated;
REVOKE EXECUTE ON FUNCTION trigger_enhanced_agent_responses() FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_assumption_challenge_count FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_blog_posts_updated_at FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_decision_dissent_count FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_inbox_brief_updated_at FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_insight_comment_count FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_insight_like_count FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_jobs_search_vector FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_jobs_updated_at FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_marketplace_items_search_vector FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_marketplace_items_updated_at FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_pod_forecast_stats FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_pods_search_vector FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_post_comment_count FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_post_like_count FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_posts_search_vector FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_response_vote_count FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_stats_on_challenge_response FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_stats_on_comment FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_stats_on_like FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_stats_on_pod_join FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_stats_on_post FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_user_challenge_streak FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_user_reputation FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_user_streak FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_workspace_updated_at FROM authenticated;
REVOKE EXECUTE ON FUNCTION user_has_thread_access FROM authenticated;

-- ============================================================
-- PART 3: Pin search_path on 6 vulnerable functions
-- ============================================================

ALTER FUNCTION backfill_agent_responses_for_assumption(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION backfill_basic_agent_response(uuid, uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION generate_agent_response(uuid, uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION generate_comprehensive_agent_response(uuid, uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION trigger_agent_responses() SET search_path = public, pg_temp;
ALTER FUNCTION trigger_enhanced_agent_responses() SET search_path = public, pg_temp;

-- ============================================================
-- PART 4: Revoke CRUD from anon and authenticated on 6 locked tables
-- ============================================================

REVOKE SELECT, INSERT, UPDATE, DELETE ON email_confirmation_tokens FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON email_confirmation_tokens FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON password_reset_attempts FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON password_reset_attempts FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON processed_stripe_events FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON processed_stripe_events FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON agent_posting_queue FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON agent_posting_queue FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON agent_routing_config FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON agent_routing_config FROM authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON workspace_seed_threads FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON workspace_seed_threads FROM authenticated;
